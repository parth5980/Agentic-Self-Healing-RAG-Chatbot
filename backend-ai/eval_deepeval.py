"""
DeepEval evaluation for PNX AI's RAG pipeline — using local Ollama (free, no API key).

Install once:
    pip install deepeval --break-system-packages

No CLI setup needed — the Ollama model is configured directly in code below.
Just make sure Ollama is running and mistral is pulled:
    ollama pull mistral

Run:
    python eval_deepeval.py
"""

import json
import time
import os
from deepeval import evaluate
from deepeval.evaluate.configs import AsyncConfig
from deepeval.test_case import LLMTestCase
from deepeval.models import OllamaModel
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
)

# ── 0. Configure the local Ollama judge model in code ─────────────────
# Local Mistral on CPU is slow — give it generous time budgets so
# DeepEval doesn't kill a run mid-way. Raised high since this budget
# appears to apply to the whole batch, not just one test case.
os.environ["DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE"] = "300"
os.environ["DEEPEVAL_PER_TASK_TIMEOUT_SECONDS_OVERRIDE"] = "7200"     # 2 hours

judge_model = OllamaModel(model="mistral", base_url="http://localhost:11434")

# ── 1. Load your eval set ────────────────────────────────────────────
with open("cnn_eval_dataset.json") as f:
    eval_set = json.load(f)


# ── 2. Call YOUR graph for each question ─────────────────────────────
# Your retrieval filters by thread_id, so every question here uses the
# SAME thread_id you used when you uploaded/ingested the PDF through
# your app. Otherwise retrieval filters out the PDF's chunks.
EVAL_THREAD_ID = "ff"

SMOKE_TEST = True  # set to False once you're ready to run against the real graph

from app.graph import app  # adjust import path if graph.py lives elsewhere

def invoke_with_retry(payload: dict, max_retries: int = 5):
    """Retries app.invoke() with exponential backoff if Mistral's rate limit is hit."""
    for attempt in range(max_retries):
        try:
            return app.invoke(payload)
        except Exception as e:
            msg = str(e).lower()
            is_rate_limit = "429" in msg or "rate limit" in msg or "too many requests" in msg
            if is_rate_limit and attempt < max_retries - 1:
                wait = (2 ** attempt) * 5  # 5s, 10s, 20s, 40s, 80s
                print(f"Rate limit hit, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                raise

def run_pipeline(question: str):
    if SMOKE_TEST:
        # Returns the ground-truth answer + contexts as-is, just to confirm
        # DeepEval + Ollama are working before hitting the real pipeline.
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
    retrieved_contexts = [doc.page_content for doc in result["documents"]]
    return answer, retrieved_contexts


# ── 3. Build DeepEval test cases ──────────────────────────────────────
# If a previous run already cached pipeline outputs, reuse them instead
# of calling your real graph/Mistral API again — saves time and avoids
# burning more API calls on a retry.
CACHE_FILE = "pipeline_outputs_cache.json"

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
            time.sleep(3)  # small gap between questions to ease pressure on Mistral's rate limit

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
BATCH_SIZE = 5
START_BATCH = 1  # change this to resume from a specific batch (1-indexed)

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

print("\nAll batches complete.")
