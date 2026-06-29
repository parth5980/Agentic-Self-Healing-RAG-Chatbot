# 🤖 Agentic Self-Healing RAG Chatbot

**A learning project exploring Retrieval-Augmented Generation (RAG) with self-correction mechanisms using LangGraph.**

---

## 📌 What This Does

This is a sophisticated **document Q&A system** that:
- 📚 **Retrieves** relevant documents from a vector database (Pinecone)
- 🤖 **Generates** AI responses grounded in your documents
- 🔍 **Checks its own answers** for hallucinations (wrong or made-up information)
- 🔄 **Self-corrects** when it detects errors, regenerating better answers
- 🌐 **Falls back to web search** when document retrieval fails
- 🎯 **Re-ranks results** to find the most relevant information

Instead of a dumb chatbot that sometimes makes things up, this one tries to catch and fix its own mistakes.

---

## 🎯 Key Features

| Feature | What It Does |
|---------|-------------|
| **Query Rewriting** | Takes your question and generates multiple variations to search better |
| **Multi-Query Retrieval** | Searches with different versions of your question to find more relevant docs |
| **Retrieval Grading** | Scores if retrieved documents actually answer your question |
| **Hallucination Detection** | Checks if the AI's answer is actually supported by the documents |
| **Adaptive Re-generation** | If the answer fails quality checks, regenerates a better one |
| **Web Fallback** | Uses Tavily search if document retrieval doesn't work |
| **Context Building** | Structures retrieved documents into useful context for the LLM |
| **Citation Tracking** | Remembers which documents provided the answer |

---

## 🏗️ Architecture

```
┌─────────────────────┐
│   User Question     │
└──────────┬──────────┘
           │
    ┌──────▼──────────────────┐
    │  Query Analyzer        │  Determines query type & intent
    └──────────┬─────────────┘
               │
    ┌──────────▼──────────────┐
    │  Query Rewriter        │  Rewrites for better retrieval
    └──────────┬──────────────┘
               │
    ┌──────────▼──────────────────────┐
    │ Multi-Query Generator          │  Creates query variations
    └──────────┬───────────────────────┘
               │
    ┌──────────▼──────────────────┐
    │  Document Retrieval        │  Searches Pinecone
    └──────────┬──────────────────┘
               │
    ┌──────────▼──────────────────┐
    │  Retrieval Grader          │  Is this relevant? ⭐
    └──────────┬──────────────────┘
               │
        ┌──────┴──────┐
        │ Good? │ Bad?│
        │      │      │
    ┌───▼──┐  ┌─▼──────────────────┐
    │  ✓   │  │ Web Search Fallback │
    │      │  └────────────────────┘
    │      └─────────────┬──────────┐
    │                    │          │
    ┌────────────────────▼─────┐    │
    │  Context Builder         │◄───┘
    │  (Chunk Reranking)       │
    └────────────┬─────────────┘
                 │
    ┌────────────▼──────────────┐
    │  Answer Generator (LLM)   │  Creates response
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────────┐
    │  Hallucination Checker      │  Is answer real? 🔎
    └────────────┬──────────────────┘
                 │
          ┌──────┴──────┐
          │ Good? │Bad? │
          │      │      │
       ┌──▼──┐  ┌─▼──────────────┐
       │  ✓  │  │  Regenerate    │
       │     │  │  Answer        │
       │     │  └────────┬───────┘
       │     └───────��───┤
       │                 │
    ┌──▼─────────────────▼───┐
    │  Final Answer           │
    │  (with sources & score) │
    └─────────────────────────┘
```

**The magic:** If the LLM hallucinates, it goes back and tries again with cleaner context.

---

## 📁 Project Structure

```
backend-ai/
├── main.py                 # FastAPI app with 4 endpoints
├── app/
│   ├── config.py           # LLM & API keys configuration
│   ├── graph.py            # LangGraph workflow (the core pipeline)
│   ├── nodes.py            # Individual processing steps (14KB of logic)
│   ├── ingest.py           # Document upload & indexing
│   ├── state.py            # Data structure passing through pipeline
│   └── __init__.py
├── test folder/            # Testing examples
└── .gitignore             # Env vars & cache files

```

### Key Files Explained

| File | Purpose | Size | What You'll Learn |
|------|---------|------|-------------------|
| `main.py` | FastAPI server | 4.5 KB | REST API design, streaming responses |
| `nodes.py` | Core AI logic | 14 KB | LLM orchestration, prompt engineering |
| `graph.py` | Workflow control | 4 KB | LangGraph state machines |
| `config.py` | Settings | 1.2 KB | Environment management |
| `ingest.py` | Document handling | 1.5 KB | PDF/text processing, embeddings |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- API keys: OpenAI, Pinecone, Tavily (for web search)

### 1. Clone & Setup

```bash
# Clone the repo
git clone https://github.com/parth5980/Agentic-Self-Healing-RAG-Chatbot.git
cd Agentic-Self-Healing-RAG-Chatbot

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in `backend-ai/`:

```env
# LLM
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Vector Database
PINECONE_API_KEY=your-key
PINECONE_INDEX_NAME=documind
PINECONE_NAMESPACE=default

# Web Search
TAVILY_API_KEY=tvly-...

# Optional
DEBUG=True
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
curl -X POST http://localhost:8000/new-chat

# Ask a question
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is RAG?",
    "thread_id": "your-thread-id",
    "chat_history": []
  }'
```

---

## 📚 API Endpoints

### `POST /new-chat`
Creates a new conversation thread.

**Response:**
```json
{
  "thread_id": "abc-123-def"
}
```

---

### `POST /chat`
Sends a question and streams the RAG pipeline response.

**Request:**
```json
{
  "message": "What is RAG?",
  "thread_id": "abc-123-def",
  "chat_history": []
}
```

**Response (Server-Sent Events):**
```
data: {"type": "status", "message": "🔍 Analyzing query..."}
data: {"type": "status", "message": "📚 Retrieving documents..."}
data: {"type": "status", "message": "🔎 Checking answer quality..."}
data: {"type": "answer", "content": "RAG is..."}
data: {"type": "done"}
```

---

### `POST /ingest`
Uploads and indexes a document.

**Request (multipart form):**
```
source_type: "pdf" or "text" or "url"
file: (binary file for PDF)
source: (URL or text for others)
```

**Response:**
```json
{
  "success": true,
  "message": "Document indexed successfully",
  "chunks": 42
}
```

---

### `GET /health`
Health check.

**Response:**
```json
{
  "status": "ok"
}
```

---

## 🧠 How Self-Healing Works

The AI follows this logic:

```python
1. Generate Answer from Retrieved Docs
   ↓
2. Check: "Is this answer actually from the documents?"
   ├─ Yes? → Send it! ✅
   └─ No (hallucinating)? → Go to Step 3
   
3. Try Again with Better Context
   ↓
4. Check Again
   ├─ Yes? → Send it! ✅
   └─ Still No? → Try Web Search
   
5. Last Resort: Search the Web
   ├─ Found? → Use web result ✅
   └─ Not Found? → Say "I don't know" ✅
```

**Example:**

| Stage | Output |
|-------|--------|
| **Q: "Who founded OpenAI?"** | |
| Retrieval | Found docs about OpenAI but not founders |
| First Answer | "Sam Altman and John Smith founded OpenAI" ❌ (hallucinated) |
| Hallucination Check | "NOT in documents!" 🚨 |
| Regenerate | Tried again, still hallucinated |
| Web Search | Found real answer: "Sam Altman, Elon Musk, others" |
| Final Answer | "According to web search, Sam Altman, Elon Musk, and others founded OpenAI" ✅ |

---

## 📊 What You'll Learn

### LLM & AI Concepts
- ✅ Embeddings and vector search
- ✅ RAG (Retrieval-Augmented Generation)
- ✅ Prompt engineering & few-shot learning
- ✅ Hallucination detection
- ✅ Re-ranking & context optimization

### Software Engineering
- ✅ Building APIs with FastAPI
- ✅ Streaming responses (Server-Sent Events)
- ✅ State management in multi-step workflows
- ✅ Error handling & retries
- ✅ Environment configuration

### LangChain/LangGraph
- ✅ Creating agent workflows
- ✅ Conditional routing (if-else logic in pipelines)
- ✅ State machines for complex processes
- ✅ Tool integration (LLM calling functions)

---

## 🔬 Example: How a Query Flows

```
User Input: "What are the benefits of RAG?"

1️⃣  Query Analyzer
    Input: "What are the benefits of RAG?"
    Output: { query_type: "explanation", intent: "learning" }

2️⃣  Query Rewriter
    Input: "What are the benefits of RAG?"
    Output: "What are the advantages of Retrieval-Augmented Generation?"

3️⃣  Multi-Query Generator
    Input: Original + Rewritten query
    Output: [
      "What are the benefits of RAG?",
      "Why use Retrieval-Augmented Generation?",
      "RAG advantages and use cases",
      "How does RAG improve LLM accuracy?"
    ]

4️⃣  Retrieve Documents
    Input: Multiple queries above
    Output: [doc1.pdf (score: 0.92), doc2.pdf (score: 0.87), ...]

5️⃣  Grade Retrieval
    "Are these docs relevant to the original question?"
    Output: YES (confidence: 0.95)

6️⃣  Context Builder (Reranker)
    Input: Retrieved docs
    Output: "RAG provides: 1. Accuracy from real docs, 2. Up-to-date info, ..."

7️⃣  Answer Generator
    Input: Context + Question
    Output: "RAG (Retrieval-Augmented Generation) provides several benefits:
             1. Improved accuracy by grounding responses in real documents
             2. Reduced hallucinations..."

8️⃣  Hallucination Checker
    "Is the answer supported by retrieved docs?"
    Output: YES ✅

9️⃣  Final Response
    Output (to user): 
    {
      "answer": "RAG provides several benefits...",
      "sources": ["doc1.pdf", "doc2.pdf"],
      "confidence": 0.96
    }
```

---

## 🧪 Next Steps for Learning

### Beginner
- [ ] Run the server and test `/health` endpoint
- [ ] Try uploading a document via `/ingest`
- [ ] Ask a simple question about your uploaded document

### Intermediate
- [ ] Modify prompts in `nodes.py` to see how answers change
- [ ] Add new checks (e.g., answer length, confidence threshold)
- [ ] Implement chat memory (currently stateless)

### Advanced
- [ ] Replace Pinecone with local ChromaDB
- [ ] Use smaller LLM (Ollama/Llama 2 instead of GPT-4)
- [ ] Add persistent database for chat history
- [ ] Deploy to production (Docker + cloud)
- [ ] Add frontend (React/Next.js)

---

## 🛠️ Troubleshooting

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
```

### "Pinecone connection failed"
- Verify your API key is correct
- Check if your index name matches
- Ensure you have internet connection

### "No documents retrieved"
- Upload a document first via `/ingest`
- Check Pinecone dashboard to confirm docs were indexed
- Try different search queries

---

## 📖 Resources to Learn More

**About RAG:**
- [What is RAG? (Pinecone blog)](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [LangChain RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/)

**About LangGraph:**
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [State Machines Explained](https://en.wikipedia.org/wiki/Finite-state_machine)

**About FastAPI:**
- [FastAPI Official Guide](https://fastapi.tiangolo.com/)
- [Streaming Responses](https://fastapi.tiangolo.com/advanced/server-sent-events/)

---

## 📝 License

This is a learning project. Feel free to use it for education and personal projects.

---

## 🙋 Questions?

Check:
1. `nodes.py` - Comments explain what each AI node does
2. `graph.py` - Shows how nodes connect and flow
3. Error messages - They're intentionally descriptive for learning

---

## 🎓 What This Teaches You

By studying this code, you'll understand:
- How modern AI assistants actually work (not just ChatGPT)
- Why they sometimes hallucinate and how to prevent it
- How to build production-grade LLM applications
- What happens "under the hood" in RAG systems

Good luck with your learning! 🚀

---

**Made with ❤️ while learning AI/ML**
