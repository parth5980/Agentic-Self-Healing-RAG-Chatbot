import uuid
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os

from app.graph import app as rag_app
from app.ingest import ingest_document

# FastAPI app
app = FastAPI(title="DocuMind API")

# CORS — allow frontend to call this API
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
    source_type: str  # 'url', 'youtube', 'text'
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


# Endpoints
@app.post("/new-chat")
def new_chat():
    """Generate a new thread ID for a new conversation"""
    thread_id = str(uuid.uuid4())
    return {"thread_id": thread_id}


@app.post("/chat")
def chat(request: ChatRequest):
    """Run the RAG pipeline and return the answer"""
    state = get_initial_state(request.message, request.chat_history)
    result = rag_app.invoke(state)
    return {
        "thread_id": request.thread_id,
        "answer": result["final_answer"]
    }


@app.post("/ingest")
async def ingest(
    source_type: str = Form(...),
    source: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Ingest a document into Pinecone"""

    # Handle PDF file upload
    if source_type == "pdf" and file:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        result = ingest_document("pdf", temp_path)
        os.remove(temp_path)
        return result

    # Handle URL, YouTube, Text
    if source:
        result = ingest_document(source_type, source)
        return result

    return {"success": False, "message": "No source provided"}


@app.get("/health")
def health():
    return {"status": "ok"}