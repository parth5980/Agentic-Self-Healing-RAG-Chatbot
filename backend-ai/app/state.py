from typing import TypedDict, List, Literal

from langchain_core.documents import Document


class AgentState(TypedDict):

    # Input
    query_type: Literal["rag", "chat", "web"]
    question: str
    chat_history: List[dict]

    # Query processing
    rewritten_query: str
    all_queries: List[str]

    # Retrieval
    documents: List[Document]
    top_docs: List[dict]
    context: str
    retrieval_score: float
    retrieval_retry_count: int

    # Generation
    answer: str
    hallucination_retry_count: int
    hallucination_pass: bool

    # Grading
    answer_score: float

    # Final
    sources: List[str]
    final_answer: str