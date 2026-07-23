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
import os
from app.config import supabase, SUPABASE_BUCKET
import tempfile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


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

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a query router for a RAG chatbot that has access to content the user has ingested — uploaded PDFs, ingested web pages, and ingested YouTube video transcripts.

Classify the user's query into exactly one category:

- 'summary': the query asks for a broad, whole-document summary or overview of an uploaded PDF specifically. This is ONLY for PDF-wide summaries, not specific facts or sections, and NOT for YouTube videos or URLs.
- 'rag': the query asks about specific content, facts, sections, or details that would come from content the user has ingested (PDF, web page, or YouTube transcript) — including summaries of a YouTube video or URL (not PDF), and follow-up questions continuing a document-based conversation.
- 'chat': the query is general knowledge, a definition, small talk, or a question about the assistant itself (who are you, what can you do).
- 'web': the query explicitly needs current, real-time, or recent information (today's news, current prices, latest events) that a static document or general knowledge cannot answer.

Examples for 'summary' (PDF-wide only):
"summarize my pdf" -> summary
"what does the pdf I uploaded contain" -> summary
"give me an overview of the document" -> summary
"can you summarize the file I sent" -> summary
"what is this pdf about" -> summary
"tell me everything in the pdf" -> summary
"give me a full summary of my document" -> summary

Examples for 'rag' (specific facts, or non-PDF summaries):
"Give summary of the youtube video I shared" -> rag
"summarize the article from the link" -> rag
"summarize the url I sent" -> rag
"Summarize the introduction section" -> rag
"What does the contract say about termination?" -> rag
"What does chapter 3 talk about?" -> rag
"What about the next part?" (after a document question) -> rag
"tell me more about that" (following a document-based answer) -> rag
"what does the video say about X" -> rag

Examples for 'chat':
"What is photosynthesis?" -> chat
"Who are you?" -> chat
"what can you do" -> chat
"hi, how are you" -> chat
"explain what a neural network is" (no document reference) -> chat

Examples for 'web':
"tell me about us and iran war " -> web
"What's today's weather in Delhi?" -> web
"What's the latest news on the elections?" -> web
"who is the current prime minister of India" -> web
"what's the stock price of X today" -> web

Rule: if the query could reasonably be about content the user has already ingested and there is any ambiguity, choose 'rag' over 'chat' or 'web'. Only choose 'summary' when it is unmistakably a request for a whole-PDF summary — if in doubt between 'summary' and 'rag', choose 'rag'.

Respond with ONLY one word: 'summary', 'rag', 'chat' or 'web'. Nothing else."""),
        ("human", """{history}Current question: {question}""")
    ])

    chain = prompt | llm_small
    result = chain.invoke({
        "history": history,
        "question": state["question"]
    })
    query_type = result.content.strip().lower()

    if query_type not in ["summary","rag", "chat", "web"]:
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
        docs = vectorstore.similarity_search(
            query,
            k=5,
            filter={"thread_id": state["thread_id"]}
        )
        all_docs.extend(docs)

    return {"documents": all_docs}


def grade_retrieval(state: AgentState) -> AgentState:
    """Grade the relevance of retrieved documents"""

    docs_sample = state["documents"][:5]
    docs_content = "\n\n".join([doc.page_content[:500] for doc in docs_sample])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a strict retrieval grader for a RAG system.

Your job is NOT to judge general topical similarity. Your job is to judge
whether the retrieved documents contain enough SPECIFIC information to
actually answer the user's question.

Score from 0 to 5:
- 0-2: The documents do not contain the specific facts, entities, or
  sections needed to answer the question — even if they share keywords
  or a general topic with it.
- 3-5: The documents contain the specific information needed to answer
  the question directly.

If the question asks about a specific named entity, section, or topic
(e.g. "the DianSource section") and that name/entity does not appear
anywhere in the documents, score 0-2 regardless of general subject
overlap.

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
            "source_type": doc.metadata.get("source_type", "document"),
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
        source_type = doc.get("source_type", "document")
        context += f"[Chunk {i+1} - from {source_type}]\n{doc['content']}\n\n"
        if doc["source"]:
            sources.append(doc["source"])

    return {"context": context, "sources": sources}
    


def answer_generator(state: AgentState) -> AgentState:
    """Generate answer from context using mistral-large"""

    history = format_chat_history(state["chat_history"])

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a helpful assistant. Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say "I don't have enough information to answer this."
Be clear, concise and accurate.
Each chunk in the context is labeled with its source type (e.g. "from pdf", "from youtube", "from url"). When relevant, mention which source your answer is based on, e.g. "According to your PDF..." or "According to the video...". If the context mixes multiple source types, make clear which parts come from which.
Always respond in the same language the user asked the question in, even if the provided context is in a different language. Translate the relevant information into the question's language."""),
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
If the context doesn't contain the answer, say "I don't have enough information."
Each chunk in the context is labeled with its source type (e.g. "from pdf", "from youtube", "from url"). When relevant, mention which source your answer is based on, e.g. "According to your PDF..." or "According to the video...". If the context mixes multiple source types, make clear which parts come from which.
Always respond in the same language the user asked the question in, even if the provided context is in a different language. Translate the relevant information into the question's language."""),
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
        
    if not state.get("hallucination_pass", True):
        score = min(score, 3.0)

    if score < 4:
        return {
            "answer_score": score,
            "documents": [],
            "top_docs": [],
            "context": "",
            "retrieval_retry_count": 0,
            "hallucination_retry_count": 0,
            "answer_retry_count": state.get("answer_retry_count", 0) + 1,
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
        (
            "system",
            """
    You are intelligent Agentic RAG chatbot designed to provide accurate, helpful, and conversational responses.
    
    Your responsibilities:
    1. Answer general knowledge questions clearly and accurately.
    2. Use the provided conversation history to answer follow-up questions and maintain context.
    3. If the user asks about previous messages, use the chat history when relevant.
    4. Be friendly, professional, and concise.
    5. If you do not know an answer, honestly say you don't know instead of making up information.
    6. Always respond in the same language the user's question is asked in.
    7. If the user asks something that requires specific facts from an uploaded document (not general knowledge), say you don't have access to that document in this mode, rather than guessing.
    
    Identity:
    - Your name is PNX AI.
    - You are a Self-Healing RAG (Retrieval-Augmented Generation) chatbot.
    - You can answer questions from uploaded documents, general knowledge, and web search.
    - You maintain conversation context using the provided chat history.
    
    If the user asks:
    • Who are you?
    • What are you?
    • Who made you?
    • Who developed you?
    • Who built this project?
    • Tell me about yourself.
    
    Reply enthusiastically:
    
    "👋 Hello! I am PNX AI, a Agentic Self-Healing RAG ChatBot designed to assist with information retrieval and answer your questions accurately. As an AI, I am built to continuously adapt and improve my responses to help you better.

    I was developed by a two-person engineering team.

    🎨 Frontend & Architecture:
    Ashish — built the MERN-stack architecture, handling the React and TailwindCSS frontend alongside the Express backend.

    🚀 Backend & AI Development:
    Parth — AI/ML engineer, developed the backend artificial intelligence and self-healing retrieval architecture.

    I can answer questions from uploaded documents, general knowledge, and current web information while maintaining conversation context."
    
    For all other questions, answer naturally using the provided conversation history when appropriate.
    """
        ),
        (
            "human",
            """
    Previous Conversation:
    {history}
    
    Current User Question:
    {question}
    """
        )
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
        ("system", """You are a helpful assistant that answers questions using real-time web search results.

Guidelines:
- Base your answer only on the provided web search results, not prior knowledge, since the user is asking for current/up-to-date information.
- Synthesize information across multiple results rather than relying on just one, when they cover the same point.
- If results disagree or give conflicting information, mention the disagreement rather than silently picking one.
- Prefer more recent information when results conflict and publication dates or recency are indicated.
- Reference which result supports each claim using its number, like [1] or [2], matching the result order given.
- If the web search results don't actually contain relevant information to answer the question, say so honestly instead of guessing.
- Always respond in the same language the user's question is asked in, even if the web search results are in a different language."""),
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

def get_pdf_path_for_thread(thread_id: str) -> str:
    """Find the original PDF's Supabase path for a given thread_id"""
    results = vectorstore.similarity_search(
        "summary",
        k=1,
        filter={"thread_id": thread_id}
    )
    if not results:
        return None
    return results[0].metadata.get("pdf_path")


def download_pdf_from_supabase(storage_path: str) -> str:
    """Download a PDF from Supabase Storage to a unique local temp file"""
    response = supabase.storage.from_(SUPABASE_BUCKET).download(storage_path)

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp_file.write(response)
    temp_file.close()

    return temp_file.name
    
def map_reduce_summarize(full_text: str) -> str:
    """Summarize a long document by splitting into sections, summarizing each, then combining"""
    section_splitter = RecursiveCharacterTextSplitter(chunk_size=8000, chunk_overlap=200)
    sections = section_splitter.split_text(full_text)

    map_prompt = ChatPromptTemplate.from_messages([
        ("system", "Summarize the following section of a document. Be concise but capture all key points, names, and facts mentioned."),
        ("human", "{section}")
    ])
    map_chain = map_prompt | llm_large

    section_summaries = []
    for section in sections:
        try:
            result = map_chain.invoke({"section": section})
            section_summaries.append(result.content)
        except Exception:
            continue

    if not section_summaries:
        return "Sorry, I couldn't generate a summary due to repeated errors. Please try again shortly."

    if len(section_summaries) == 1:
        return section_summaries[0]

    combined = "\n\n".join(section_summaries)
    reduce_prompt = ChatPromptTemplate.from_messages([
        ("system", "The following are summaries of different sections of the same document. Combine them into one single, coherent, well-organized summary of the entire document."),
        ("human", "{combined_summaries}")
    ])
    reduce_chain = reduce_prompt | llm_large

    try:
        final_result = reduce_chain.invoke({"combined_summaries": combined})
        return final_result.content
    except Exception:
        return "\n\n---\n\n".join(section_summaries)

def summary_node(state: AgentState) -> AgentState:
    """Generate a full-document summary for the PDF uploaded in this conversation"""

    pdf_path = get_pdf_path_for_thread(state["thread_id"])
    if not pdf_path:
        return {"final_answer": "I couldn't find a PDF uploaded in this conversation to summarize."}

    local_file = download_pdf_from_supabase(pdf_path)

    try:
        loader = PyPDFLoader(local_file)
        docs = loader.load()
        full_text = "\n\n".join([d.page_content for d in docs])
        summary = map_reduce_summarize(full_text)
    finally:
        os.remove(local_file)

    return {"final_answer": summary}
