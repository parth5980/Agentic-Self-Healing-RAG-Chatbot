import os
import dotenv

# Paste your actual keys directly here, just for this one-time script
os.environ["MISTRAL_API_KEY"] =  os.getenv("MISTRAL_API_KEY")
os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["LANGSMITH_API_KEY"] =  os.getenv("LANGSMITH_API_KEY")
os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")
os.environ["JINA_API_KEY"] = os.getenv("JINA_API_KEY")

from app.config import index

stats = index.describe_index_stats()
print(stats)

confirm = input("Type 'DELETE ALL' to confirm wiping the entire Pinecone index: ")

if confirm == "DELETE ALL":
    index.delete(delete_all=True)
    print("All vectors deleted from the index.")
else:
    print("Cancelled. Nothing was deleted.")