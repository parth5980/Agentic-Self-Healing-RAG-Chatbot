import os
import dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")

from app.config import index

stats = index.describe_index_stats()
print(stats)

confirm = input("Type 'DELETE ALL' to confirm wiping the entire Pinecone index: ")

if confirm == "DELETE ALL":
    index.delete(delete_all=True)
    print("All vectors deleted from the index.")
else:
    print("Cancelled. Nothing was deleted.")