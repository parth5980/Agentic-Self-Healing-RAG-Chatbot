"""
DeepEval evaluation — SECOND script, covering the two metrics not run before:
  - Hallucination        (needs golden `context`, not just retrieved context)
  - Contextual Relevancy (checks how much of the retrieved context is relevant)

Kept SEPARATE from the main eval_deepeval.py (which already ran Faithfulness,
Answer Relevancy, Contextual Precision, Contextual Recall) so this run is
faster and doesn't re-burn Groq tokens on metrics you already have.

Reuses:
  - transformer_pipeline_outputs_cache.json  -> real answers + retrieved contexts
  - transformer_eval_dataset.json            -> golden `contexts` (source-of-truth
                                                 passages), used as `context` for
                                                 the Hallucination metric

Run:
    python eval_deepeval_extra_metrics.py
"""

import json
import time
import os
import csv
import asyncio
from deepeval import evaluate
from deepeval.evaluate.configs import AsyncConfig
from deepeval.test_case import LLMTestCase
from deepeval.models.base_model import DeepEvalBaseLLM
from openai import OpenAI, AsyncOpenAI
from deepeval.metrics import (
    HallucinationMetric,
    ContextualRelevancyMetric,
)

# ── 0. Groq as the judge model (same wrapper as the main script, with
#    retry-on-429 built in — Groq's free tier caps tokens per minute AND
#    per day, so a 429 mid-run is expected, not a bug) ──────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class GroqJudgeModel(DeepEvalBaseLLM):
    def __init__(self, model="openai/gpt-oss-120b"):
        self.model_name = model
        self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=GROQ_API_KEY)
        self.async_client = AsyncOpenAI(base_url="https://api.groq.com/openai/v1", api_key=GROQ_API_KEY)

    def load_model(self):
        return self.model_name

    def get_model_name(self):
        return self.model_name

    def _call(self, client, prompt, schema=None, max_retries=6):
        for attempt in range(max_retries):
            try:
                kwargs = {"response_format": {"type": "json_object"}} if schema else {}
                response = client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    **kwargs,
                )
                content = response.choices[0].message.content
                if schema:
                    return schema.model_validate_json(content)
                return content
            except Exception as e:
                msg = str(e).lower()
                is_rate_limit = "429" in msg or "rate_limit" in msg or "rate limit" in msg
                if is_rate_limit and attempt < max_retries - 1:
                    wait = min((2 ** attempt) * 5, 60)
                    print(f"  Groq rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise

    async def _a_call(self, client, prompt, schema=None, max_retries=6):
        for attempt in range(max_retries):
            try:
                kwargs = {"response_format": {"type": "json_object"}} if schema else {}
                response = await client.chat.completions.create(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    **kwargs,
                )
                content = response.choices[0].message.content
                if schema:
                    return schema.model_validate_json(content)
                return content
            except Exception as e:
                msg = str(e).lower()
                is_rate_limit = "429" in msg or "rate_limit" in msg or "rate limit" in msg
                if is_rate_limit and attempt < max_retries - 1:
                    wait = min((2 ** attempt) * 5, 60)
                    print(f"  Groq rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    await asyncio.sleep(wait)
                else:
                    raise

    def generate(self, prompt: str, schema=None):
        return self._call(self.client, prompt, schema)

    async def a_generate(self, prompt: str, schema=None):
        return await self._a_call(self.async_client, prompt, schema)

judge_model = GroqJudgeModel()

# ── 1. Load golden dataset (has the real source `contexts` per question,
#    used as `context` for Hallucination — NOT the same as what your
#    retriever actually returned) ───────────────────────────────────────
with open("transformer_eval_dataset.json") as f:
    eval_set = json.load(f)
golden_context_by_question = {item["question"]: item["contexts"] for item in eval_set}

# ── 2. Load your pipeline's cached outputs (real answers + what your
#    retriever actually pulled back — reused as-is, no new pipeline calls) ─
CACHE_FILE = "transformer_pipeline_outputs_cache.json"
if not os.path.exists(CACHE_FILE):
    raise FileNotFoundError(
        f"{CACHE_FILE} not found. This script only re-judges cached pipeline "
        "outputs — run the main eval_deepeval.py first to generate it."
    )
with open(CACHE_FILE) as f:
    pipeline_outputs = json.load(f)

# ── 3. Build test cases ─────────────────────────────────────────────────
# - retrieval_context = what your retriever actually returned (used by
#   Contextual Relevancy)
# - context = golden source passages (used by Hallucination, which checks
#   the answer against ground truth, not against retrieval quality)
test_cases = []
for item in pipeline_outputs:
    golden_context = golden_context_by_question.get(item["question"])
    if golden_context is None:
        print(f"  WARNING: no golden context found for question, skipping: {item['question'][:60]}...")
        continue
    test_cases.append(
        LLMTestCase(
            input=item["question"],
            actual_output=item["answer"],
            expected_output=item["ground_truth"],
            retrieval_context=item["contexts"],
            context=golden_context,
        )
    )

# ── 4. Define the two metrics ────────────────────────────────────────────
metrics = [
    HallucinationMetric(threshold=0.5, model=judge_model),
    ContextualRelevancyMetric(threshold=0.7, model=judge_model),
]

# ── 5. Evaluate in small batches (same rate-limit-safe approach as the
#    main script) ─────────────────────────────────────────────────────────
BATCH_SIZE = 2  # keeps token demand per batch low against Groq's TPM/TPD caps
START_BATCH = 1  # change this to resume from a specific batch (1-indexed)
RESULTS_CSV = "transformer_deepeval_extra_results.csv"
BATCH_SUMMARY_CSV = "transformer_deepeval_extra_batch_summary.csv"
FAILURES_CSV = "transformer_deepeval_extra_failures.csv"

if START_BATCH == 1 and not os.path.exists(RESULTS_CSV):
    with open(RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "question", "metric", "score", "passed", "reason"])
    with open(BATCH_SUMMARY_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "metric", "avg_score", "pass_rate_pct", "passed_count", "total_count"])
    with open(FAILURES_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "question", "metric", "score", "threshold", "reason"])

total_batches = (len(test_cases) + BATCH_SIZE - 1) // BATCH_SIZE
for batch_num in range(1, total_batches + 1):
    if batch_num < START_BATCH:
        print(f"Skipping batch {batch_num}/{total_batches} (already done)")
        continue

    batch_start = (batch_num - 1) * BATCH_SIZE
    batch = test_cases[batch_start:batch_start + BATCH_SIZE]
    print(f"\n=== Running batch {batch_num}/{total_batches} ({len(batch)} test cases) ===")

    results = evaluate(
        test_cases=batch,
        metrics=metrics,
        async_config=AsyncConfig(run_async=True, max_concurrent=1),
    )
    print(f"=== Batch {batch_num} done ===")
    print(results)

    with open(RESULTS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for test_result in results.test_results:
            for metric_data in test_result.metrics_data:
                writer.writerow([
                    batch_num,
                    test_result.input,
                    metric_data.name,
                    metric_data.score,
                    metric_data.success,
                    metric_data.reason,
                ])

    metric_scores = {}
    for test_result in results.test_results:
        for metric_data in test_result.metrics_data:
            metric_scores.setdefault(metric_data.name, []).append(
                (metric_data.score, metric_data.success)
            )

    with open(BATCH_SUMMARY_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for metric_name, scores in metric_scores.items():
            values = [s for s, _ in scores]
            passed_count = sum(1 for _, p in scores if p)
            total_count = len(scores)
            avg_score = sum(values) / total_count
            pass_rate = (passed_count / total_count) * 100
            writer.writerow([batch_num, metric_name, round(avg_score, 3), round(pass_rate, 1), passed_count, total_count])

    with open(FAILURES_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for test_result in results.test_results:
            for metric_data in test_result.metrics_data:
                if not metric_data.success:
                    writer.writerow([
                        batch_num,
                        test_result.input,
                        metric_data.name,
                        metric_data.score,
                        metric_data.threshold,
                        metric_data.reason,
                    ])

    print(f"Saved batch {batch_num}: results -> {RESULTS_CSV}, summary -> {BATCH_SUMMARY_CSV}, failures -> {FAILURES_CSV}")

    if batch_num < total_batches:
        print("Pausing 30s between batches to let Groq's per-minute token window reset...")
        time.sleep(30)

print("\nAll batches complete.")
print(f"Per-question scores: {RESULTS_CSV}")
print(f"Per-batch metric matrix: {BATCH_SUMMARY_CSV}")
print(f"Failure reasons only: {FAILURES_CSV}")
