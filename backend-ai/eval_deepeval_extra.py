"""
DeepEval evaluation, part 2 — Hallucination + Contextual Relevancy metrics.

Reuses the pipeline outputs already cached by eval_deepeval.py, so this does
NOT call your real graph/Mistral API again — only re-judges the same
question/answer/context triples with 2 additional metrics.

Run eval_deepeval.py first (with SMOKE_TEST = False) so
pipeline_outputs_cache.json exists, then run this:
    python eval_deepeval_extra.py
"""

import json
import os
import csv
from deepeval import evaluate
from deepeval.evaluate.configs import AsyncConfig
from deepeval.test_case import LLMTestCase
from deepeval.models import OllamaModel
from deepeval.metrics import ContextualRelevancyMetric, HallucinationMetric

os.environ["DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE"] = "300"
os.environ["DEEPEVAL_PER_TASK_TIMEOUT_SECONDS_OVERRIDE"] = "7200"

judge_model = OllamaModel(model="mistral", base_url="http://localhost:11434")

# ── Load cached pipeline outputs from part 1 ──────────────────────────
with open("pipeline_outputs_cache.json") as f:
    cached = json.load(f)

test_cases = [
    LLMTestCase(
        input=item["question"],
        actual_output=item["answer"],
        expected_output=item["ground_truth"],
        retrieval_context=item["contexts"],
        context=item["contexts"],  # required by HallucinationMetric
    )
    for item in cached
]

metrics = [
    ContextualRelevancyMetric(threshold=0.7, model=judge_model),
    HallucinationMetric(threshold=0.5, model=judge_model),  # lower = better; max allowed hallucination
]

# ── Batched run with resume support + CSV logging ─────────────────────
BATCH_SIZE = 5
START_BATCH = 1  # change this to resume from a specific batch (1-indexed)
RESULTS_CSV = "deepeval_extra_results.csv"
BATCH_SUMMARY_CSV = "deepeval_extra_batch_summary.csv"
FAILURES_CSV = "deepeval_extra_failures.csv"

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
                    batch_num, test_result.input, metric_data.name,
                    metric_data.score, metric_data.success, metric_data.reason,
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
            writer.writerow([
                batch_num, metric_name, round(sum(values) / total_count, 3),
                round((passed_count / total_count) * 100, 1), passed_count, total_count,
            ])

    with open(FAILURES_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for test_result in results.test_results:
            for metric_data in test_result.metrics_data:
                if not metric_data.success:
                    writer.writerow([
                        batch_num, test_result.input, metric_data.name,
                        metric_data.score, metric_data.threshold, metric_data.reason,
                    ])

    print(f"Saved batch {batch_num}: results -> {RESULTS_CSV}, summary -> {BATCH_SUMMARY_CSV}, failures -> {FAILURES_CSV}")

print("\nAll batches complete.")
print(f"Per-question scores: {RESULTS_CSV}")
print(f"Per-batch metric matrix: {BATCH_SUMMARY_CSV}")
print(f"Failure reasons only: {FAILURES_CSV}")
