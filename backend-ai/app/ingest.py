from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    WebBaseLoader,
    YoutubeLoader
)
from app.config import vectorstore


def load_and_split(source_type: str, source: str) -> list:
    """Load documents from any source and split into chunks."""

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    if source_type == "pdf":
        loader = PyPDFLoader(source)
        documents = loader.load()

    elif source_type == "url":
        loader = WebBaseLoader(source)
        documents = loader.load()

    elif source_type == "youtube":
        loader = YoutubeLoader.from_youtube_url(source)
        documents = loader.load()

    elif source_type == "text":
        documents = [Document(page_content=source)]

    else:
        raise ValueError(f"Invalid source_type: {source_type}")

    chunks = text_splitter.split_documents(documents)
    return chunks


def ingest_document(source_type: str, source: str) -> dict:
    """Main ingestion function called by FastAPI."""
    try:
        chunks = load_and_split(source_type, source)
        vectorstore.add_documents(chunks)
        return {
            "success": True,
            "message": f"Successfully ingested {len(chunks)} chunks from {source_type}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}