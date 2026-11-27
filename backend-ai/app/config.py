import os
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from pathlib import Path
from supabase import create_client
from langchain_groq import ChatGroq

# Load environment variables
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
JINA_API_KEY = os.getenv("JINA_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

llm_small = ChatGroq(model="openai/gpt-oss-20b", api_key=GROQ_API_KEY, temperature=0)
llm_large = ChatGroq(model="openai/gpt-oss-120b", api_key=GROQ_API_KEY, temperature=0)
# LangSmith tracing
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = LANGSMITH_API_KEY
os.environ["LANGCHAIN_PROJECT"] = "PNX AI"

# LLM clients
#llm_small = ChatMistralAI(
#   model="mistral-small-latest",
 #   api_key=MISTRAL_API_KEY,
  #  temperature=0
#)

#llm_large = ChatMistralAI(
 #   model="mistral-large-latest",
  #  api_key=MISTRAL_API_KEY,
   # temperature=0
#)

# Embeddings
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GEMINI_API_KEY,
    output_dimensionality=1024
)

# Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index("rag-chatbot")

# Vectorstore
vectorstore = PineconeVectorStore(
    index=index,
    embedding=embeddings,
    text_key="text"
)
# Supabase (for storing original PDFs, used by the summary feature)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)