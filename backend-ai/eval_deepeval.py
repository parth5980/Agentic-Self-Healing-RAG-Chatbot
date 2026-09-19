"""
DeepEval evaluation for PNX AI's RAG pipeline — using Groq as the judge model
(fast, free, no local CPU bottleneck — replaces the earlier Ollama judge,
which kept timing out on multi-hop questions with longer 2-chunk contexts).

Install once:
    pip install deepeval openai --break-system-packages

Uses the same GROQ_API_KEY already set up in .env for the pipeline itself.

Run:
    python eval_deepeval.py
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
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
)

# ── 0. Groq as the judge model (fast, free, no local CPU bottleneck) ──
# Groq exposes an OpenAI-compatible endpoint, so we wrap it in DeepEval's
# custom-LLM interface instead of using local Ollama (which kept timing
# out on CPU). Uses the same GROQ_API_KEY already set up for the pipeline.
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
        """Retries on Groq 429 (rate limit) with backoff instead of crashing the batch.
        Groq's free tier caps tokens-per-minute (TPM), and DeepEval fires several
        judge calls per test case concurrently, so hitting 429 mid-batch is expected
        — not a bug. We wait it out and retry rather than letting it propagate up."""
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
                    wait = min((2 ** attempt) * 5, 60)  # 5,10,20,40,60,60s
                    print(f"  Groq rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise

    async def _a_call(self, client, prompt, schema=None, max_retries=6):
        """Async version of the same retry-on-429 logic, used by a_generate."""
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
                    wait = min((2 ** attempt) * 5, 60)  # 5,10,20,40,60,60s
                    print(f"  Groq rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    await asyncio.sleep(wait)
                else:
                    raise

    def generate(self, prompt: str, schema=None):
        return self._call(self.client, prompt, schema)

    async def a_generate(self, prompt: str, schema=None):
        return await self._a_call(self.async_client, prompt, schema)

judge_model = GroqJudgeModel()

# ── 1. Load your eval set ────────────────────────────────────────────
with open("transformer_eval_dataset.json") as f:
    eval_set = json.load(f)


# ── 2. Call YOUR graph for each question ─────────────────────────────
# Your retrieval filters by thread_id, so every question here uses the
# SAME thread_id you used when you uploaded/ingested the PDF through
# your app. Otherwise retrieval filters out the PDF's chunks.
EVAL_THREAD_ID = "transformer"

SMOKE_TEST = False  # cache already holds real pipeline outputs — keep this False

from app.graph import app  # adjust import path if graph.py lives elsewhere

def invoke_with_retry(payload: dict, max_retries: int = 8):
    """Retries app.invoke() with exponential backoff if Mistral's rate limit is hit.
    A single question fires many internal Mistral calls (query_analyzer,
    classifiers, rewriter, grader, generator, hallucination check, answer
    grader...), so the free-tier limit can be hit mid-question. Longer,
    capped backoff gives the limit more time to actually reset."""
    for attempt in range(max_retries):
        try:
            return app.invoke(payload)
        except Exception as e:
            msg = str(e).lower()
            is_rate_limit = "429" in msg or "rate limit" in msg or "too many requests" in msg
            if is_rate_limit and attempt < max_retries - 1:
                wait = min((2 ** attempt) * 10, 180)  # 10,20,40,80,160,180,180,180 (capped at 3 min)
                print(f"Rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                raise

def run_pipeline(question: str):
    if SMOKE_TEST:
        # Returns the ground-truth answer + contexts as-is, just to confirm
        # DeepEval + the judge model are working before hitting the real pipeline.
        for item in eval_set:
            if item["question"] == question:
                return item["ground_truth"], item["contexts"]
        raise ValueError(f"No matching item for question: {question}")

    result = invoke_with_retry({
        "question": question,
        "thread_id": EVAL_THREAD_ID,
        "needs_uploaded_content": True,   # forces the RAG path (skips chat/web routing)
        "chat_history": [],
        "retrieval_retry_count": 0,
        "hallucination_retry_count": 0,
        "answer_retry_count": 0,
    })

    answer = result["final_answer"]
    # top_docs = final reranked chunks that actually reached the LLM (not raw ~20 pre-rerank)
    # Falls back to [] if the graph routed away from RAG (chat_node/web_search_node/summary_node),
    # which happens if query_analyzer decided this question didn't need the uploaded document.
    if "top_docs" not in result:
        print(f"  WARNING: no top_docs for this question — graph likely skipped RAG retrieval entirely.")
    retrieved_contexts = [doc["content"] for doc in result.get("top_docs", [])]
    return answer, retrieved_contexts


# ── 3. Build DeepEval test cases ──────────────────────────────────────
# If a previous run already cached pipeline outputs, reuse them instead
# of calling your real graph/Mistral API again — saves time and avoids
# burning more API calls on a retry.
CACHE_FILE = "transformer_pipeline_outputs_cache.json"

if os.path.exists(CACHE_FILE):
    print(f"Found existing {CACHE_FILE}, reusing cached pipeline outputs (skipping API calls).")
    with open(CACHE_FILE) as f:
        pipeline_outputs = json.load(f)
else:
    pipeline_outputs = []
    for i, item in enumerate(eval_set):
        answer, retrieved_contexts = run_pipeline(item["question"])
        pipeline_outputs.append({
            "question": item["question"],
            "ground_truth": item["ground_truth"],
            "answer": answer,
            "contexts": retrieved_contexts,
        })
        print(f"Processed {i + 1}/{len(eval_set)}: {item['question'][:50]}...")
        if not SMOKE_TEST:
            time.sleep(15)  # gap between questions — one question fires many Mistral calls internally

    with open(CACHE_FILE, "w") as f:
        json.dump(pipeline_outputs, f, indent=2)

test_cases = [
    LLMTestCase(
        input=item["question"],
        actual_output=item["answer"],
        expected_output=item["ground_truth"],
        retrieval_context=item["contexts"],
    )
    for item in pipeline_outputs
]

# ── 4. Define metrics (4 core RAG metrics) ─────────────────
metrics = [
    FaithfulnessMetric(threshold=0.7, model=judge_model),
    AnswerRelevancyMetric(threshold=0.7, model=judge_model),
    ContextualPrecisionMetric(threshold=0.7, model=judge_model),
    ContextualRecallMetric(threshold=0.7, model=judge_model),
]

# ── 5. Evaluate in small batches ────────────────────────────────────
# Splitting avoids losing everything if one batch times out — results
# from completed batches are printed before moving to the next.
#
# If a run crashes partway, note which batch number it reached, set
# START_BATCH to that number, and rerun — earlier batches are skipped
# (you already saw and kept their printed results).
BATCH_SIZE = 2  # lowered from 5 — Groq free tier caps at 8000 tokens/minute, and
                 # each test case fires 4 metrics concurrently (each making 1-2 calls),
                 # so 5 at once was blowing past the cap almost immediately
START_BATCH = 8  # change this to resume from a specific batch (1-indexed)
RESULTS_CSV = "transformer_deepeval_results.csv"
BATCH_SUMMARY_CSV = "transformer_deepeval_batch_summary.csv"
FAILURES_CSV = "transformer_deepeval_failures.csv"

# Write headers once, only if starting fresh (not resuming a crashed run)
if START_BATCH == 1 and not os.path.exists(RESULTS_CSV):
    with open(RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "question", "metric", "score", "passed", "reason"])
    with open(BATCH_SUMMARY_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "metric", "avg_score", "pass_rate_pct", "passed_count", "total_count"])
    with open(FAILURES_CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(["batch", "question", "metric", "score", "threshold", "reason"])

all_results = []
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
    all_results.append(results)

    # ── Per-row results (question x metric) ──
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

    # ── Per-batch aggregate (precision/recall/etc. matrix, one row per metric) ──
    metric_scores = {}  # metric_name -> list of (score, passed)
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

    # ── Failures only, with full reason, for quick review ──
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
print(f"Per-batch metric matrix (precision/recall/etc.): {BATCH_SUMMARY_CSV}")
print(f"Failure reasons only: {FAILURES_CSV}")
