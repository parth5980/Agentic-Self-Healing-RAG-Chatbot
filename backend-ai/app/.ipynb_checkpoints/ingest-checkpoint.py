from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    WebBaseLoader,
    YoutubeLoader
)
from app.config import vectorstore, supabase, SUPABASE_BUCKET
import os

def upload_pdf_to_supabase(filename: str, thread_id: str) -> str:
    """Upload the original PDF file to Supabase Storage, return its storage path"""
    storage_path = f"{thread_id}/{os.path.basename(filename)}"

    with open(filename, "rb") as f:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=storage_path,
            file=f.read(),
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )

    return storage_path


def load_and_split(source_type: str, source: str, thread_id: str) -> list:
    """Load documents from any source and split into chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    pdf_path = None                                          
    if source_type == "pdf":
        pdf_path = upload_pdf_to_supabase(source, thread_id)  
        loader = PyPDFLoader(source)
        documents = loader.load()
    elif source_type == "url":
        loader = WebBaseLoader(source)
        documents = loader.load()
    elif source_type == "youtube":
        loader = YoutubeLoader.from_youtube_url(source, language=["en", "hi"])
        documents = loader.load()
    elif source_type == "text":
        documents = [Document(page_content=source)]
    else:
        raise ValueError(f"Invalid source_type: {source_type}")
    chunks = text_splitter.split_documents(documents)
    for chunk in chunks:
        chunk.metadata["thread_id"] = thread_id
        chunk.metadata["source_type"] = source_type
        if pdf_path:                                      
            chunk.metadata["pdf_path"] = pdf_path              
    return chunks

def ingest_document(source_type: str, source: str, thread_id: str) -> dict:
    """Main ingestion function called by FastAPI."""
    try:
        chunks = load_and_split(source_type, source, thread_id)
        vectorstore.add_documents(chunks)
        return {
            "success": True,
            "message": f"Successfully ingested {len(chunks)} chunks from {source_type}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}