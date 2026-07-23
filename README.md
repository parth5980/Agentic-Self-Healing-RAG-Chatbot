# 🤖 Agentic Self-Healing RAG Chatbot

**A sophisticated Retrieval-Augmented Generation (RAG) system with self-correction mechanisms, multi-source document ingestion, and intelligent query routing.**

> **Learning Project**: Built to demonstrate advanced RAG patterns, LangGraph orchestration, and production-grade error handling.

---

## 📌 What This Does

This is a production-oriented **document Q&A system** that:
- 📚 **Retrieves** relevant documents from a vector database (Pinecone)
- 🤖 **Generates** AI responses grounded in your documents
- 🔍 **Checks its own answers** for hallucinations (wrong or made-up information)
- 🔄 **Self-corrects** when it detects errors, regenerating better answers
- 🌐 **Falls back to web search** when document retrieval fails
- 🎯 **Re-ranks results** using semantic similarity to find the most relevant information
- 📄 **Summarizes** full documents using map-reduce for long PDFs
- 💾 **Stores PDFs** in Supabase for retrieval during summarization

Instead of a dumb chatbot that sometimes makes things up, **this one tries to catch and fix its own mistakes**.

---

## 🎯 Key Features

| Feature | What It Does | Status |
|---------|-------------|--------|
| **Query Classification** | Routes queries to RAG, chat, web search, or summary modes | ✅ Production-ready |
| **Query Rewriting** | Rewrites questions for better retrieval | ✅ |
| **Multi-Query Retrieval** | Searches with 3+ variations to find more relevant docs | ✅ |
| **Retrieval Grading** | Scores if retrieved documents actually answer your question | ✅ |
| **Semantic Reranking** | Uses Jina API to rerank results by semantic relevance | ✅ |
| **Hallucination Detection** | Checks if the AI's answer is supported by documents | ✅ |
| **Adaptive Re-generation** | Regenerates answers up to 2x if hallucination detected | ✅ |
| **Web Fallback** | Uses Tavily search if document retrieval fails | ✅ |
| **PDF Summarization** | Map-reduce approach for full-document summaries | ✅ |
| **Citation Tracking** | Returns sources for every answer | ✅ |
| **Streaming API** | Real-time SSE updates with node status | ✅ |
| **Multi-Source Ingestion** | PDFs, URLs, YouTube transcripts, raw text | ✅ |
| **Thread-Based Conversations** | Isolated chat sessions with metadata tracking | ✅ |

---

## 🏗️ System Architecture

### High-Level Flow

```
┌─────────────────────┐
│   User Question     │
└──────────┬──────────┘
           │
    ┌──────▼──────────────────┐
    │  Query Analyzer        │  ← Routes: RAG | Chat | Web | Summary
    └──────────┬─────────────┘
               │
       ┌───────┴─────────┬───────────────┬──────────────┐
       │                 │               │              │
    ┌──▼──┐        ┌────▼─────┐   ┌────▼────┐   ┌──▼──────┐
    │Chat │        │RAG Route  │   │Web Route │   │Summary   │
    │Node │        │(Complex)  │   │ (Simple) │   │(Map-Red) │
    └──┬──┘        └────┬─────┘   └────┬────┘   └──┬──────┘
       │                │              │            │
       └────────────────┼──────────────┴────────────┘
                        │
                   ┌────▼────────────────┐
                   │  Final Response     │
                   │ (with sources)      │
                   └─────────────────────┘
```

### RAG Pipeline (Detailed)

```
1. Query Rewriter
   ↓
2. Multi-Query Generator (generates 3 variations)
   ↓
3. Retrieve Documents (Pinecone search with thread filter)
   ↓
4. Grade Retrieval (LLM scores relevance 0-5)
   ├─ Score ≥ 3? → Continue
   ├─ Retry < 3? → Refine & retry
   └─ Max retries? → Web search fallback
   ↓
5. Rerank (Jina API reranks top 5 documents)
   ↓
6. Context Builder (formats context from reranked docs)
   ↓
7. Answer Generator (LLM generates answer)
   ↓
8. Hallucination Check (validates answer against context)
   ├─ Pass? → Continue
   ├─ Fail & retries < 2? → Regenerate with stricter prompt
   └─ Max retries? → Continue anyway
   ↓
9. Answer Grader (scores answer quality 0-5)
   ├─ Score ≥ 4? → Return answer
   └─ Score < 4? → Retry pipeline
   ↓
10. Citation Formatting
    ↓
11. Final Response (streamed to user)
```

---

## 📁 Project Structure

```
backend-ai/
├── main.py                 # FastAPI app with 4 endpoints
├── app/
│   ├── config.py           # LLM, embeddings & API keys
│   ├── state.py            # TypedDict for pipeline state
│   ├── graph.py            # LangGraph workflow (core orchestration)
│   ├── nodes.py            # 18 individual processing nodes (~650 lines)
│   ├── ingest.py           # Document upload & indexing
│   └── __init__.py
├── test folder/            # Testing notebooks
└── .env.example            # Environment template (add to repo)

backend-express/           # Frontend/orchestration layer (MERN stack)

```

### Key Modules Explained

| Module | Lines | Purpose | Key Functions |
|--------|-------|---------|----------------|
| `nodes.py` | ~650 | AI pipeline logic | 18 nodes: query analyzer, rewriter, retriever, hallucination checker, etc. |
| `graph.py` | ~130 | LangGraph orchestration | State machine with 4 conditional edge functions + routing logic |
| `main.py` | ~160 | FastAPI server | REST endpoints, SSE streaming, request models |
| `config.py` | ~60 | Configuration | LLM clients (Mistral small/large), embeddings, Pinecone, Supabase, API keys |
| `state.py` | ~40 | Data model | AgentState TypedDict with 16 fields tracking pipeline progress |
| `ingest.py` | ~60 | Document ingestion | PDF/text/URL/YouTube loading, chunking, embedding, Pinecone indexing, Supabase upload |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- API keys for:
  - **Mistral AI** (LLM + embeddings)
  - **Pinecone** (vector database)
  - **Tavily** (web search fallback)
  - **Jina** (semantic reranking)
  - **Supabase** (PDF storage)

### 1. Clone & Setup

```bash
git clone https://github.com/parth5980/Agentic-Self-Healing-RAG-Chatbot.git
cd Agentic-Self-Healing-RAG-Chatbot

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend-ai/requirements.txt
```

### 2. Configure Environment

Create `backend-ai/.env`:

```env
# LLM & Embeddings
MISTRAL_API_KEY=your-mistral-key
LANGSMITH_API_KEY=your-langsmith-key

# Vector Database
PINECONE_API_KEY=your-pinecone-key

# Web Search
TAVILY_API_KEY=your-tavily-key

# Semantic Reranking
JINA_API_KEY=your-jina-key

# Document Storage
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
SUPABASE_BUCKET=pnx-ai-documents

# Optional
DEBUG=False
```

### 3. Run the Server

```bash
cd backend-ai
python main.py
```

Server runs at `http://localhost:8000`

### 4. Test It

```bash
# Health check
curl http://localhost:8000/health

# Create new chat session
THREAD_ID=$(curl -s -X POST http://localhost:8000/new-chat | jq -r '.thread_id')

# Ask a question
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is RAG?",
    "thread_id": "'$THREAD_ID'",
    "chat_history": []
  }'

# Upload a PDF
curl -X POST http://localhost:8000/ingest \
  -F "source_type=pdf" \
  -F "file=@document.pdf" \
  -F "thread_id='$THREAD_ID'"
```

---

## 📡 API Endpoints

### `POST /new-chat`
Creates a new conversation thread.

**Response:**
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### `POST /chat`
Sends a question and streams the RAG pipeline response via Server-Sent Events.

**Request:**
```json
{
  "message": "What is RAG?",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "chat_history": [
    {"role": "user", "content": "Previous question"},
    {"role": "assistant", "content": "Previous answer"}
  ]
}
```

**Response (Server-Sent Events):**
```
data: {"type": "status", "message": "🔍 Analyzing query..."}
data: {"type": "status", "message": "📚 Retrieving documents..."}
data: {"type": "status", "message": "🎯 Reranking chunks..."}
data: {"type": "status", "message": "🔎 Checking answer quality..."}
data: {"type": "answer", "content": "RAG is Retrieval-Augmented Generation...\n\n**Sources:**\n[1] document.pdf"}
data: {"type": "done"}
```

---

### `POST /ingest`
Uploads and indexes a document (PDF, URL, YouTube, or raw text).

**Request (multipart form):**
```
source_type: "pdf" | "url" | "youtube" | "text"
file: (binary PDF file if source_type="pdf")
source: (URL or text content for other types)
thread_id: (conversation thread ID)
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully ingested 42 chunks from pdf",
  "chunks": 42
}
```

---

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

---

## 🧠 How Self-Healing Works

The pipeline includes **three layers of validation**:

### Layer 1: Retrieval Grading
```
Retrieved documents relevant? (0-5 score)
├─ Score ≥ 3 → Proceed
├─ Score < 3 & retry < 3 → Refine query
└─ Max retries → Web search fallback
```

### Layer 2: Hallucination Detection
```
Generated answer grounded in context?
├─ Yes → Proceed
├─ No & retry < 2 → Regenerate with stricter prompt
└─ Max retries → Accept answer
```

### Layer 3: Answer Grading
```
Answer quality score (0-5)?
├─ Score ≥ 4 → Return to user
├─ Score < 4 & retry < 2 → Retry entire pipeline
└─ Max retries → Return answer
```

**Example Flow:**

| Stage | Output | Action |
|-------|--------|--------|
| Q: "Who founded OpenAI?" | — | — |
| Retrieval | Found docs about OpenAI (score: 3.2) | ✅ Proceed |
| Generation | "Sam Altman and John Smith founded OpenAI" | — |
| Hallucination Check | "NOT in documents!" | ❌ Fail |
| Regenerate | "I don't have information about OpenAI's founders in the provided documents" | ✅ Pass |
| Answer Grade | Score: 4.1 | ✅ Return to user |

---

## 📊 Scoring System

### Retrieval Score (0-5)
- **0-2**: Documents don't contain specific facts needed
- **3-5**: Documents have specific information to answer question

### Hallucination Check
- **Pass**: Answer fully supported by context
- **Fail**: Answer contains unsupported claims

### Answer Grade (0-5)
- **0-3**: Incomplete, irrelevant, or inaccurate
- **4-5**: Relevant, complete, accurate

---

## 🔌 Technology Stack

### LLM & Embeddings
- **Mistral AI** - small (fast) and large (powerful) models
- **LangChain** - prompt engineering, document loading, vector stores
- **LangGraph** - state machine orchestration

### Data
- **Pinecone** - vector embeddings storage & similarity search
- **Supabase** - original PDF file storage

### APIs & Services
- **Tavily** - web search fallback
- **Jina** - semantic reranking
- **LangSmith** - LLM observability (optional)

### Backend
- **FastAPI** - REST API & streaming
- **Pydantic** - request validation
- **Python 3.10+**

---

## 🛠️ Development & Testing

### Run Tests (using notebooks)
```bash
cd backend-ai
jupyter notebook "test folder/testing_phase.ipynb"
```

### Add Your Own Nodes
1. Define node function in `app/nodes.py`:
```python
def my_node(state: AgentState) -> AgentState:
    """Do something with state"""
    result = my_logic(state["question"])
    return {"my_output": result}
```

2. Add to graph in `app/graph.py`:
```python
workflow.add_node("my_node", my_node)
workflow.add_edge("previous_node", "my_node")
```

### Modify Prompts
All prompts are in `app/nodes.py`. Edit `ChatPromptTemplate.from_messages()` to change behavior:
- Query routing: line 36
- Answer generation: line 303
- Hallucination check: line 328

---

## 🧪 Troubleshooting

### "Cannot import module app.graph"
```bash
# Make sure you're in the backend-ai directory
cd backend-ai
python main.py
```

### "API key not found"
```bash
# Check your .env file exists and has all required keys
cat .env
# Ensure SUPABASE_URL, SUPABASE_KEY, and SUPABASE_BUCKET are set
```

### "Pinecone connection failed"
- Verify API key is correct
- Check index name matches (`rag-chatbot`)
- Ensure you have internet connection

### "No documents retrieved"
- Upload a document first via `/ingest`
- Check Pinecone dashboard to confirm docs were indexed
- Try different search queries
- Ensure `thread_id` filter matches

### "Supabase upload failed"
- Verify `SUPABASE_BUCKET` name matches your bucket in Supabase
- Check that bucket has public read permissions
- Ensure `SUPABASE_URL` and `SUPABASE_KEY` are correct

### Rate Limited
- Tavily: 10 requests/day on free tier
- Jina: Check API rate limits
- Pinecone: Check your quota
- Mistral: Check request limits

---

## 📖 Resources to Learn More

**About RAG:**
- [What is RAG? (Pinecone blog)](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [LangChain RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/)
- [RAG Best Practices (OpenAI)](https://platform.openai.com/docs/guides/retrieval-augmented-generation)

**About LangGraph:**
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [State Machines Explained](https://en.wikipedia.org/wiki/Finite-state_machine)
- [LangSmith for Tracing](https://smith.langchain.com/)

**About FastAPI:**
- [FastAPI Official Guide](https://fastapi.tiangolo.com/)
- [Streaming Responses](https://fastapi.tiangolo.com/advanced/server-sent-events/)
- [Async Programming](https://fastapi.tiangolo.com/async-concurrency/)

**Tools Used:**
- [Mistral AI Docs](https://docs.mistral.ai/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [Supabase Docs](https://supabase.com/docs)
- [Jina Reranker](https://jina.ai/)

---

## 📈 Performance Tips

### Optimization Strategies

1. **Reduce Chunk Size** (if retrieval is slow)
   - Edit `ingest.py`: `chunk_size=500` (from 1000)
   - Trade-off: More chunks = more compute

2. **Skip Reranking** (if cost is high)
   - Comment out reranker node in `graph.py`
   - Use raw Pinecone scores instead

3. **Use Mistral Small** (everywhere)
   - Replace `llm_large` with `llm_small` in prompts
   - Trade-off: Lower quality answers, faster responses

4. **Reduce Max Retries**
   - Edit routing functions in `graph.py` to lower retry thresholds
   - Example: `if state["hallucination_retry_count"] >= 1` (was 2)

5. **Batch Ingest** (for many documents)
   - Implement bulk ingest endpoint
   - Use Pinecone batch API

---

## 🐛 Known Limitations

1. **No persistence**: Chat history is stateless (passed per request, not stored)
2. **No authentication**: Anyone can use the API
3. **Limited testing**: Only testing notebooks, no pytest suite
4. **Retry logic**: Can theoretically loop if answer_score stays <4
5. **Rate limiting**: No built-in rate limiting
6. **Single user**: No user isolation (all threads share same Pinecone index)

---

## 🎓 What This Teaches You

By studying this code, you'll understand:
- How modern AI assistants actually work (not just ChatGPT)
- Why they sometimes hallucinate and how to prevent it
- How to build production-grade LLM applications
- What happens "under the hood" in RAG systems
- LangGraph state machines and conditional routing
- FastAPI streaming and real-time updates
- Document ingestion and embedding workflows
- Semantic search and reranking strategies

---

## 🙋 Questions?

1. **How does X work?** → Check `app/nodes.py` (each function has docstrings)
2. **Why does it route to chat?** → Check `query_analyzer` in `nodes.py` (line 31)
3. **How do I add a new data source?** → Edit `ingest.py` and `query_analyzer` prompts
4. **Can I use a different LLM?** → Yes! Replace Mistral with OpenAI/Claude in `config.py`

---

## 🚀 What's Next?

- [ ] Add pytest suite
- [ ] Persist chat history to database
- [ ] Add authentication & user isolation
- [ ] Build React frontend
- [ ] Deploy to production (Fly.io, Railway, or AWS)
- [ ] Add metrics dashboard
- [ ] Implement fine-tuning on domain-specific data

---

**Made with ❤️ while learning AI/ML**
