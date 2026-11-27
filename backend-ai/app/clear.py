from config import index
import os
from dotenv import load_dotenv
from pinecone import Pinecone

from app.config import index

print(index.describe_index_stats())

load_dotenv()
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("rag-chatbot")
print(index.describe_index_stats())

# 1. Check size and what's inside
stats = index.describe_index_stats()
print(stats)

# 2. Delete everything
index.delete(delete_all=True)