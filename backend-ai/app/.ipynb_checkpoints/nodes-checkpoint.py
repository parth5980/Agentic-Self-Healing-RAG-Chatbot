import requests
from typing import List
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from tavily import TavilyClient

from app.config import (
    llm_small, llm_large, vectorstore,
    JINA_API_KEY, TAVILY_API_KEY
)
from app.state import AgentState


def format_chat_history(chat_history: List[dict]) -> str:
    """Format chat history for LLM prompt"""
    if not chat_history:
        return ""
    history = ""
    for msg in chat_history:
        role = msg["role"].capitalize()
        content = msg["content"]
        history += f"{role}: {content}\n"
    return f"\nPrevious conversation:\n{history}\n"


def query_analyzer(state: AgentState) -> AgentState:
    """Classify query as rag, chat or web"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a query classifier. Classify the user query into one of three categories:
- 'rag': if the query requires searching uploaded documents or PDFs
- 'chat': if the query is general knowledge, concepts, definitions or simple questions
- 'web': if the query requires current information, latest news, recent events, or real-time data

Respond with ONLY one word: 'rag', 'chat' or 'web'. Nothing else."""),
        ("human", "{question}")
    ])

    chain = prompt | llm_small
    result = chain.invoke({"question": state["question"]})
    query_type = result.content.strip().lower()

    if query_type not in ["rag", "chat", "web"]:
        query_type = "rag"

    return {"query_type": query_type}


def query_rewriter(state: AgentState) -> AgentState:
    """Rewrite the user query for better retrieval"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert query rewriter for a RAG system.
Rewrite the user's question to be more specific and retrieval-friendly.
Keep it concise — one clear sentence only.
Do NOT add multiple options or examples.
Return ONLY the rewritten query. Nothing else."""),
        ("human", "Original question: {question}")
    ])

    chain = prompt | llm_small
    result = chain.invoke({"question": state["question"]})

    return {"rewritten_query": result.content.strip()}


def multi_query_generator(state: AgentState) -> AgentState:
    """Generate multiple query variations for better retrieval"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert at generating query variations for a RAG system.
Generate exactly 3 different variations of the given query.
Each variation should be semantically similar but worded differently.
Return ONLY the 3 queries separated by | character.
Example format: query one | query two | query three
Nothing else."""),
        ("human", "Query: {rewritten_query}")
    ])

    chain = prompt | llm_small
    result = chain.invoke({"rewritten_query": state["rewritten_query"]})

    queries = [q.strip() for q in result.content.strip().split("|") if q.strip()]
    all_queries = [state["rewritten_query"]] + queries

    return {"all_queries": all_queries}


def retrieve_documents(state: AgentState) -> AgentState:
    """Retrieve documents from Pinecone for all queries"""

    all_docs = []
    for query in state["all_queries"]:
        docs = vectorstore.similarity_search(query, k=5)
        all_docs.extend(docs)

    return {"documents": all_docs}


def grade_retrieval(state: AgentState) -> AgentState:
    """Grade the relevance of retrieved documents"""

    docs_sample = state["documents"][:5]
    docs_content = "\n\n".join([doc.page_content[:500] for doc in docs_sample])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a retrieval grader.
Judge whether the retrieved documents are relevant to answer the user's question.
Give a score from 0 to 5:
- 0-2: Documents are not relevant at all
- 3-5: Documents are relevant and useful

Return ONLY a single number between 0 and 5. Nothing else."""),
        ("human", """Question: {question}

Retrieved Documents:
{documents}""")
    ])

    chain = prompt | llm_small
    result = chain.invoke({
        "question": state["question"],
        "documents": docs_content
    })

    try:
        score = float(result.content.strip())
    except:
        score = 3.0

    return {"retrieval_score": score}


def refine_query(state: AgentState) -> AgentState:
    """Refine the query when retrieval score is low"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert at reformulating search queries.
The previous query did not retrieve relevant documents.
Generate a completely different version of the query using different keywords and angle.
Return ONLY the new query. Nothing else."""),
        ("human", """Original question: {question}
Previous query that failed: {rewritten_query}""")
    ])

    chain = prompt | llm_small
    result = chain.invoke({
        "question": state["question"],
        "rewritten_query": state["rewritten_query"]
    })

    new_retry_count = state["retrieval_retry_count"] + 1

    return {
        "rewritten_query": result.content.strip(),
        "retrieval_retry_count": new_retry_count,
        "documents": [],
        "all_queries": []
    }


def tavily_search(state: AgentState) -> AgentState:
    """Fallback web search when Pinecone retrieval fails"""

    client = TavilyClient(api_key=TAVILY_API_KEY)
    results = client.search(query=state["question"], max_results=5)

    docs = []
    for r in results["results"]:
        doc = Document(
            page_content=r["content"],
            metadata={"source": r["url"], "title": r.get("title", "")}
        )
        docs.append(doc)

    return {"documents": docs}


def reranker(state: AgentState) -> AgentState:
    """Rerank retrieved documents using Jina Reranker API"""

    documents = state["documents"]

    # Handle empty documents
    if not documents:
        return {"top_docs": []}

    doc_texts = [doc.page_content for doc in documents]

    response = requests.post(
        "https://api.jina.ai/v1/rerank",
        headers={"Authorization": f"Bearer {JINA_API_KEY}", "Content-Type": "application/json"},
        json={"model": "jina-reranker-v3", "query": state["rewritten_query"], "documents": doc_texts, "top_n": 5}
    )

    data = response.json()
    top_docs = []

    for item in data["results"]:
        doc = documents[item["index"]]
        top_docs.append({
            "content": doc.page_content,
            "source": doc.metadata.get("source", ""),
            "score": item["relevance_score"]
        })

    return {"top_docs": top_docs}


def context_builder(state: AgentState) -> AgentState:
    """Build clean context from top reranked documents"""

    top_docs = state["top_docs"]
    context = ""
    sources = []
    seen = set()

    for i, doc in enumerate(top_docs):
        if doc["content"] in seen:
            continue
        seen.add(doc["content"])
        context += f"[Chunk {i+1}]\n{doc['content']}\n\n"
        if doc["source"]:
            sources.append(doc["source"])

    return {"context": context, "sources": sources}


def answer_generator(state: AgentState) -> AgentState:
    """Generate answer from context using mistral-large"""

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a helpful assistant. Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say "I don't have enough information to answer this."
Be clear, concise and accurate."""),
        ("human", """{history}Context:
{context}

Question: {question}""")
    ])

    chain = prompt | llm_large
    result = chain.invoke({
        "history": history,
        "context": state["context"],
        "question": state["question"]
    })

    return {"answer": result.content.strip()}


def hallucination_check(state: AgentState) -> AgentState:
    """Check if answer is grounded in context"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a hallucination checker.
Check if the answer is fully grounded in the provided context.
If everything in the answer is supported by the context, respond with 'pass'.
If the answer contains information not present in the context, respond with 'fail'.
Respond with ONLY one word: 'pass' or 'fail'. Nothing else."""),
        ("human", """Context:
{context}

Answer:
{answer}""")
    ])

    chain = prompt | llm_small
    result = chain.invoke({
        "context": state["context"],
        "answer": state["answer"]
    })

    check = result.content.strip().lower()
    if check not in ["pass", "fail"]:
        check = "pass"

    return {"hallucination_pass": check == "pass"}


def regenerate(state: AgentState) -> AgentState:
    """Regenerate answer with stricter prompt when hallucination detected"""

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a strict assistant. Answer ONLY using the provided context.
Do NOT add any information that is not explicitly present in the context.
Do NOT make assumptions or inferences beyond what is written.
If the context doesn't contain the answer, say "I don't have enough information." """),
        ("human", """{history}Context:
{context}

Question: {question}""")
    ])

    chain = prompt | llm_large
    result = chain.invoke({
        "history": history,
        "context": state["context"],
        "question": state["question"]
    })

    new_count = state["hallucination_retry_count"] + 1

    return {
        "answer": result.content.strip(),
        "hallucination_retry_count": new_count
    }


def answer_grader(state: AgentState) -> AgentState:
    """Grade the quality of the generated answer"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an answer quality grader.
Grade the answer based on relevance, completeness and accuracy to the question.
Give a score from 0 to 5:
- 0-3: Answer is incomplete, irrelevant or inaccurate
- 4-5: Answer is relevant, complete and accurate

Return ONLY a single number between 0 and 5. Nothing else."""),
        ("human", """Question: {question}

Answer: {answer}""")
    ])

    chain = prompt | llm_small
    result = chain.invoke({
        "question": state["question"],
        "answer": state["answer"]
    })

    try:
        score = float(result.content.strip())
    except:
        score = 4.0

    if score < 4:
        return {
            "answer_score": score,
            "documents": [],
            "top_docs": [],
            "context": "",
            "answer": "",
            "retrieval_retry_count": 0,
            "hallucination_retry_count": 0,
            "all_queries": [],
            "sources": []
        }

    return {"answer_score": score}


def source_citation(state: AgentState) -> AgentState:
    """Format sources into clean citations"""

    sources = state["sources"]
    answer = state["answer"]

    if not sources:
        return {"final_answer": answer}

    unique_sources = list(set(sources))
    citation_text = "\n\n**Sources:**"
    for i, source in enumerate(unique_sources):
        citation_text += f"\n[{i+1}] {source}"

    return {"final_answer": answer + citation_text}


def final_response(state: AgentState) -> AgentState:
    """Return the final response"""
    return {"final_answer": state["final_answer"]}


def chat_node(state: AgentState) -> AgentState:
    """Directly answer general chat questions"""

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Answer the user's question clearly and concisely."),
        ("human", "{history}Question: {question}")
    ])

    chain = prompt | llm_large
    result = chain.invoke({
        "history": history,
        "question": state["question"]
    })

    return {"final_answer": result.content.strip()}


def web_search_node(state: AgentState) -> AgentState:
    """Search web for current information and generate answer"""

    client = TavilyClient(api_key=TAVILY_API_KEY)
    results = client.search(query=state["question"], max_results=5)

    context = ""
    sources = []
    for i, r in enumerate(results["results"]):
        context += f"[Result {i+1}]\n{r['content']}\n\n"
        sources.append(r["url"])

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a helpful assistant. Answer the user's question based on the provided web search results.
Be accurate and cite which result supports your answer."""),
        ("human", """{history}Web Search Results:
{context}

Question: {question}""")
    ])

    chain = prompt | llm_large
    result = chain.invoke({
        "history": history,
        "context": context,
        "question": state["question"]
    })

    answer = result.content.strip()
    citation_text = "\n\n**Sources:**"
    for i, source in enumerate(sources):
        citation_text += f"\n[{i+1}] {source}"

    return {"final_answer": answer + citation_text}