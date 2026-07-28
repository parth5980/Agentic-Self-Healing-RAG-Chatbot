from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    WebBaseLoader,
    YoutubeLoader,
    TextLoader,
    Docx2txtLoader
)
from app.config import vectorstore, supabase, SUPABASE_BUCKET,index
import uuid
import os
import requests

def delete_existing_source(thread_id: str, filename: str):
    """If this filename was already ingested in this thread, remove its old vectors first"""
    results = vectorstore.similarity_search(
        "check",
        k=1000,
        filter={"thread_id": thread_id}
    )

    source_ids_to_delete = set()
    for r in results:
        existing_path = r.metadata.get("pdf_path", "")
        if existing_path.split("/")[-1] == filename:
            source_ids_to_delete.add(r.metadata.get("source_id"))

    for sid in source_ids_to_delete:
        index.delete(filter={"thread_id": thread_id, "source_id": sid})

def upload_file_to_supabase(filename: str, thread_id: str, display_name: str = None, content_type: str = "application/octet-stream") -> str:
    """Upload the original file to Supabase Storage, return its storage path"""
    name = display_name if display_name else os.path.basename(filename)
    storage_path = f"{thread_id}/{name}"
    with open(filename, "rb") as f:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=f.read(),
            file_options={"content-type": content_type, "upsert": "true"}
        )
    return storage_path

def load_and_split(source_type: str, source: str, thread_id: str, original_filename: str = None):
    """Load documents from any source and split into chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    source_id = str(uuid.uuid4())
    pdf_path = None

    if source_type == "pdf":
        name_to_use = original_filename if original_filename else source
        pdf_path = upload_file_to_supabase(source, thread_id, display_name=name_to_use)
        loader = PyPDFLoader(source)
        documents = loader.load()

    elif source_type == "txt":
        name_to_use = original_filename if original_filename else source
        pdf_path = upload_file_to_supabase(source, thread_id, display_name=name_to_use)
        loader = TextLoader(source, encoding="utf-8")
        documents = loader.load()

    elif source_type == "docx":
        name_to_use = original_filename if original_filename else source
        pdf_path = upload_file_to_supabase(source, thread_id, display_name=name_to_use)
        loader = Docx2txtLoader(source)
        documents = loader.load()

    elif source_type == "url":
        loader = WebBaseLoader(source)
        documents = loader.load()
        url_title = documents[0].metadata.get("title") if documents else None

    elif source_type == "youtube":
        loader = YoutubeLoader.from_youtube_url(source, language=["en", "hi"])
        documents = loader.load()
        youtube_title = get_youtube_title(source)

    elif source_type == "text":
        documents = [Document(page_content=source)]

    else:
        raise ValueError(f"Invalid source_type: {source_type}")

    chunks = text_splitter.split_documents(documents)

    for chunk in chunks:
        chunk.metadata["thread_id"] = thread_id
        chunk.metadata["source_type"] = source_type
        chunk.metadata["source_id"] = source_id
    
        if source_type == "youtube":
            chunk.metadata["youtube_url"] = source
            if youtube_title:
                chunk.metadata["youtube_title"] = youtube_title

        if source_type == "url":
            chunk.metadata["original_url"] = source
            if url_title:
                chunk.metadata["url_title"] = url_title

        if pdf_path:
            chunk.metadata["pdf_path"] = pdf_path

    return chunks, source_id

def ingest_document(source_type: str, source: str, thread_id: str, original_filename: str = None) -> dict:
    """Main ingestion function called by FastAPI."""
    try:
        if original_filename and source_type in ("pdf", "txt", "docx"):
            delete_existing_source(thread_id, original_filename)

        chunks, source_id = load_and_split(source_type, source, thread_id, original_filename)
        vectorstore.add_documents(chunks)
        return {
            "success": True,
            "message": f"Successfully ingested {len(chunks)} chunks from {source_type}",
            "source_id": source_id
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_youtube_title(url: str) -> str:
    """Fetch YouTube video title via oEmbed (no API key needed)"""
    try:
        resp = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=5
        )
        if resp.status_code == 200:
            return resp.json().get("title")
    except Exception:
        pass
    return None