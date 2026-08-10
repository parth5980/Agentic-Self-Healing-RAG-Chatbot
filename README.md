# Agentic Self-Healing RAG Chatbot

A research-grade Retrieval-Augmented Generation (RAG) pipeline with agentic self-healing evaluation and diagnostics. This repository contains the project assets, notebooks, and evaluation artifacts used to build and validate a robust RAG-based QA system over domain documents.

## Table of Contents

- [Project Overview](#project-overview)
- [What I Implemented](#what-i-implemented)
- [Evaluation Summary (DeepEval / RAGAS)](#evaluation-summary-deepeval--ragas)
- [Failure Analysis & Notes](#failure-analysis--notes)
- [Architecture & Components](#architecture--components)
- [Reproducing the Evaluation](#reproducing-the-evaluation)
- [Installation (high-level)](#installation-high-level)
- [Usage (high-level)](#usage-high-level)
- [Repository Structure](#repository-structure)
- [Contributing](#contributing)
- [License & Contact](#license--contact)

---

## Project Overview

This project implements and evaluates a Retrieval-Augmented Generation (RAG) pipeline aimed at high-fidelity, low-hallucination question answering over domain documents. The focus is on reliable retrieval, accurate answer generation, and automated evaluation with rigorous diagnostics to identify judge-model or dataset artifacts.

Suggested succinct summary for reports/publication:
"The RAG pipeline achieved perfect retrieval scores (Contextual Precision/Recall = 1.00), near-perfect generation scores (Answer Relevancy = 0.95), and zero detected hallucinations (Hallucination = 0.00) across 15 evaluation questions. Faithfulness (0.89) and Contextual Relevancy (0.82) both had a small number of sub-threshold cases; manual inspection attributed these to local judge-model limitations and eval-question phrasing artifacts respectively, rather than genuine pipeline deficiencies."

---

## What I Implemented

- A RAG pipeline with:
  - Retrieval via a vector index (Pinecone).
  - Reranking using Jina.
  - LLM-based generation (model details are recorded in the repo’s config/notebooks).
- Evaluation harness using DeepEval / RAGAS to measure Faithfulness, Answer Relevancy, Contextual Precision/Recall, Contextual Relevancy, and Hallucination.
- Local judge setup used for automated scoring: Mistral 7B via Ollama (used as a lightweight LLM-as-judge).
- Full evaluation run and diagnostic analysis (15 questions, CNN Architectures dataset) with batch-level reporting and failure analysis.

Note: I did not assume or add features beyond what is described above. If you implemented additional components (e.g., a web UI, streaming generation, or a particular LLM backend), provide the exact names/paths and I will add them precisely.

---

## Evaluation Summary (DeepEval / RAGAS)

Dataset: CNN Architectures (15 questions)
Judge: Local Mistral 7B via Ollama

Batch-wise highlights:
- Retrieval (Pinecone + Jina reranking): perfect — Contextual Precision = 1.00, Contextual Recall = 1.00 (all 15 questions).
- Answer Relevancy: 0.95 average, 100% pass (15/15).
- Faithfulness: 0.89 average, 80% pass (12/15). Manual inspection shows 3 failures were due to judge-model semantic nitpicks (textually identical outputs to ground truth).
- Contextual Relevancy: 0.82 average, 80% pass (12/15). Failures tied to dataset phrasing artifacts (e.g., appended "from my pdf").
- Hallucination: 0.00 average (no hallucinations detected across 15 questions).

Full 6-metric summary:

| Metric | Average Score | Pass Rate |
|---|---:|---|
| Faithfulness | 0.89 | 80% (12/15) |
| Answer Relevancy | 0.95 | 100% (15/15) |
| Contextual Precision | 1.00 | 100% (15/15) |
| Contextual Recall | 1.00 | 100% (15/15) |
| Contextual Relevancy | 0.82 | 80% (12/15) |
| Hallucination | 0.00 (lower = better) | 100% (15/15) |

Batch matrix (summary):

| Batch | Questions | Faithfulness | Answer Relevancy | Contextual Precision | Contextual Recall |
|---|---:|---:|---:|---:|---:|
| 1 | Q1–Q5  | 0.95 (100% pass) | 1.00 (100% pass) | 1.00 (100% pass) | 1.00 (100% pass) |
| 2 | Q6–Q10 | 0.82 (60% pass)  | 0.90 (100% pass) | 1.00 (100% pass) | 1.00 (100% pass) |
| 3 | Q11–Q15| 0.90 (80% pass)  | 0.96 (100% pass) | 1.00 (100% pass) | 1.00 (100% pass) |
| **Overall (15 Q)** | — | **0.89 (80% pass, 12/15)** | **0.95 (100% pass, 15/15)** | **1.00 (100% pass, 15/15)** | **1.00 (100% pass, 15/15)** |

---

## Failure Analysis & Notes

- All three Faithfulness failures were judged due to judge-model nitpicks (the pipeline outputs were textually identical to ground truth). This indicates judge noise, not pipeline hallucination.
- Contextual Relevancy failures were due to dataset phrasing (e.g., appended phrases like "from my pdf") causing the judge to over-penalize retrievals that did not restate that exact wording.
- Evidence points to the judge being the primary source of the small number of sub-threshold Faithfulness results (local Mistral 7B via Ollama is lighter-weight and more brittle than GPT-4-class judges).

---

## Architecture & Components

High-level components implemented (as confirmed by the evaluation artifacts):

- Document ingestion -> embedding -> Pinecone vector index
- Query processing -> Jina reranker -> top-k chunks
- LLM-based generator consumes top context -> generated answer
- Evaluation harness: DeepEval / RAGAS runs automatic metrics and collects diagnostics
- Local judge: Mistral 7B running via Ollama to evaluate Faithfulness and other metrics

If you want, I can add a diagram (SVG/PNG) illustrating data flow; provide any preferred labels or filenames and I will insert it.

---

## Reproducing the Evaluation

I intentionally do not assume exact filenames or scripts. Please fill the placeholders below with repository-specific commands/files (I will update the README for you when you provide them).

1. Prepare environment
   - Install/activate Python environment (example):
     - python -m venv .venv
     - source .venv/bin/activate
     - pip install -r requirements.txt
   - Ensure Pinecone index is available and credentials are set:
     - export PINECONE_API_KEY="<YOUR_KEY>"
     - export PINECONE_ENV="<YOUR_ENV>"
   - Start local judge (Ollama + Mistral 7B) according to your setup.

2. Ingest documents and build index
   - Command: <FILL_IN: script/command to ingest documents and upsert to Pinecone>

3. Run pipeline on evaluation dataset
   - Command: <FILL_IN: script/command to run the RAG pipeline and collect outputs>

4. Run DeepEval / RAGAS evaluation
   - Command: <FILL_IN: script/command to run evaluation; include flags/config used>

5. View results
   - The evaluation output (metrics and failure cases) can be found at: <FILL_IN: path/to/eval_report or notebook>

Provide the exact script names and I will replace these placeholders with runnable commands.

---

## Installation (high-level)

These are safe, non-committal instructions that do not assert specific scripts exist. Replace placeholders with repository filenames.

1. Clone the repository
   - git clone https://github.com/parth5980/Agentic-Self-Healing-RAG-Chatbot.git
   - cd Agentic-Self-Healing-RAG-Chatbot

2. Python environment
   - python -m venv .venv
   - source .venv/bin/activate
   - pip install -r requirements.txt

3. Node (if applicable)
   - cd web or cd frontend
   - npm install

4. Configure secrets
   - export PINECONE_API_KEY="..."
   - export PINECONE_ENV="..."
   - export OLLAMA_ADDR="..." (if needed)

Fill in or correct these steps based on your repo layout and I will update them precisely.

---

## Usage (high-level)

- Open the Jupyter notebooks included in the repository to explore ingestion, indexing, and evaluation flows.
- Use the provided evaluation harness scripts (paths TBD) to reproduce the DeepEval run described in the report.
- To run a single QA query against the index:
  - Command: <FILL_IN: script/command or notebook cell>

---

## Repository Structure (suggested / inferred)

- notebooks/                   — Jupyter notebooks used for ingestion, experiments, and evaluation
- eval_reports/                — saved DeepEval outputs and diagnostic logs
- scripts/                     — ingestion, indexing, and evaluation scripts (fill actual names)
- src/                         — pipeline code (retrieval, reranker, generator wrappers)
- README.md

Please confirm actual directories and filenames; I will align this section to your repo.

---

## Contributing

Contributions welcomed. If you want to propose changes, please:
1. Open an issue describing the change.
2. Create a branch with a descriptive name.
3. Submit a pull request with tests/notebook reproductions where applicable.

---

## License & Contact

- License: <FILL_IN: e.g., MIT / Apache-2.0 / Proprietary — please specify>  
- Author / Contact: parth5980 (GitHub)

---

If you want, I can:
- Replace every <FILL_IN> placeholder with exact commands and filenames once you provide them.
- Add a short “How it works” diagram or a runnable quickstart with actual scripts from your repo.
- Create a condensed one-page abstract suitable for a paper or project page.
