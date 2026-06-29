import uuid
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os

from app.graph import app as rag_app
from app.ingest import ingest_document

# FastAPI app
app = FastAPI(title="DocuMind v2 API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# Request models
class ChatRequest(BaseModel):
    message: str
    thread_id: str
    chat_history: Optional[List[dict]] = []


class IngestRequest(BaseModel):
    source_type: str
    source: str


# Initial state template
def get_initial_state(question: str, chat_history: list) -> dict:
    return {
        "question": question,
        "chat_history": chat_history,
        "query_type": "rag",
        "rewritten_query": "",
        "all_queries": [],
        "documents": [],
        "top_docs": [],
        "context": "",
        "retrieval_score": 0.0,
        "retrieval_retry_count": 0,
        "answer": "",
        "hallucination_retry_count": 0,
        "hallucination_pass": False,
        "answer_score": 0.0,
        "sources": [],
        "final_answer": ""
    }


# Node status messages
NODE_MESSAGES = {
    "query_analyzer": "🔍 Analyzing query...",
    "query_rewriter": "✏️ Rewriting query...",
    "multi_query_generator": "🔀 Generating query variations...",
    "retrieve_documents": "📚 Retrieving documents...",
    "grade_retrieval": "⭐ Grading retrieval...",
    "refine_query": "🔄 Refining query...",
    "tavily_search": "🌐 Searching the web...",
    "reranker": "🎯 Reranking chunks...",
    "context_builder": "🏗️ Building context...",
    "answer_generator": "🤖 Generating answer...",
    "hallucination_check": "🔎 Checking answer quality...",
    "regenerate": "🔁 Regenerating answer...",
    "answer_grader": "📊 Grading answer...",
    "source_citation": "📎 Adding citations...",
    "final_response": "✅ Done!",
    "chat_node": "💬 Generating response...",
    "web_search_node": "🌐 Searching web for latest info..."
}


# SSE generator
def stream_pipeline(question: str, chat_history: list):
    """Stream pipeline node updates and final answer"""

    state = get_initial_state(question, chat_history)

    try:
        for chunk in rag_app.stream(state):
            for node_name, node_output in chunk.items():

                # Send node status
                status_msg = NODE_MESSAGES.get(node_name, f"Running {node_name}...")
                yield f"data: {json.dumps({'type': 'status', 'message': status_msg})}\n\n"

                # If final_response node — send the answer
                if node_name == "final_response":
                    final_answer = node_output.get("final_answer", "")
                    yield f"data: {json.dumps({'type': 'answer', 'content': final_answer})}\n\n"

        # Signal stream is done
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


# Endpoints
@app.post("/new-chat")
def new_chat():
    """Generate a new thread ID"""
    thread_id = str(uuid.uuid4())
    return {"thread_id": thread_id}


@app.post("/chat")
def chat(request: ChatRequest):
    """Stream the RAG pipeline response"""
    return StreamingResponse(
        stream_pipeline(request.message, request.chat_history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/ingest")
async def ingest(
    source_type: str = Form(...),
    source: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Ingest a document into Pinecone"""

    if source_type == "pdf" and file:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        result = ingest_document("pdf", temp_path)
        os.remove(temp_path)
        return result

    if source:
        result = ingest_document(source_type, source)
        return result

    return {"success": False, "message": "No source provided"}


@app.get("/health")
def health():
    return {"status": "ok"}