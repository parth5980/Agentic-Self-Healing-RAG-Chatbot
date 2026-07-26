import uuid
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.config import index, supabase, SUPABASE_BUCKET
from app.config import vectorstore
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os

from app.graph import app as rag_app
from app.ingest import ingest_document

# FastAPI app
app = FastAPI(title="PNX AI API")

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
def get_initial_state(question: str, chat_history: list, thread_id: str) -> dict:
    return {
        "question": question,
        "chat_history": chat_history,
        "thread_id": thread_id,
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
        "answer_retry_count": 0,
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
    "web_search_node": "🌐 Searching web for latest info...",
    "summary_node": "📄 Summarizing your document..."
}


# SSE generator
def stream_pipeline(question: str, chat_history: list, thread_id: str):
    """Stream pipeline node updates and final answer"""

    state = get_initial_state(question, chat_history, thread_id)

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
        error_str = str(e)
        if "429" in error_str or "rate_limit" in error_str.lower() or "Rate limit" in error_str:
            friendly_message = "Too many requests right now. Please wait a moment and try again."
        else:
            friendly_message = "Something went wrong while processing your request. Please try again."
        yield f"data: {json.dumps({'type': 'error', 'message': friendly_message})}\n\n"


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
        stream_pipeline(request.message, request.chat_history,request.thread_id),
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
    file: Optional[UploadFile] = File(None),
    thread_id: str = Form(...)
):
    """Ingest a document into Pinecone"""

    if source_type == "pdf" and file:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        result = ingest_document("pdf", temp_path, thread_id, original_filename=file.filename)
        os.remove(temp_path)
        return result

    if source:
        result = ingest_document(source_type, source, thread_id)
        return result

    return {"success": False, "message": "No source provided"}

@app.get("/list-documents")
def list_documents(thread_id: str):
    """List all distinct documents (PDFs) uploaded in a given thread"""
    results = vectorstore.similarity_search(
        "list",
        k=50,
        filter={"thread_id": thread_id}
    )

    seen_paths = set()
    documents = []
    for r in results:
        path = r.metadata.get("pdf_path")
        if path and path not in seen_paths:
            seen_paths.add(path)
            documents.append({
                "pdf_path": path,
                "filename": path.split("/")[-1]
            })

    if not documents:
        return {"success": True, "documents": [], "message": "No PDF has been uploaded in this conversation."}

    return {"success": True, "documents": documents}


@app.delete("/delete-document")
def delete_document(thread_id: str, filename: str):
    """Delete one specific document's chunks from Pinecone and its file from Supabase, by filename"""

    pdf_path = f"{thread_id}/{filename}"

    # Check if this document actually exists before trying to delete it
    existing = vectorstore.similarity_search(
        "check",
        k=1,
        filter={"thread_id": thread_id, "pdf_path": pdf_path}
    )

    if not existing:
        return {"success": False, "message": f"No document named '{filename}' found in this conversation."}

    try:
        index.delete(filter={"thread_id": thread_id, "pdf_path": pdf_path})
        supabase.storage.from_(SUPABASE_BUCKET).remove([pdf_path])
        return {"success": True, "message": f"Deleted document: {filename}"}
    except Exception as e:
        return {"success": False, "message": "Something went wrong while deleting this document. Please try again."}


@app.get("/health")
def health():
    return {"status": "ok"}
