from langgraph.graph import StateGraph, END

from app.state import AgentState
from app.nodes import (
    query_analyzer, query_rewriter, multi_query_generator,
    retrieve_documents, grade_retrieval, refine_query,
    tavily_search, reranker, context_builder, answer_generator,
    hallucination_check, regenerate, answer_grader,
    source_citation, final_response, chat_node,
    web_search_node, summary_node
)

# Conditional edge functions
def route_query(state: AgentState) -> str:
    if state["query_type"] == "chat":
        return "chat_node"
    elif state["query_type"] == "web":
        return "web_search_node"
    elif state["query_type"] == "summary":
        return "summary_node"
    else:
        return "query_rewriter"


def route_retrieval(state: AgentState) -> str:
    if state["retrieval_score"] >= 3:
        return "reranker"
    elif state["retrieval_retry_count"] >= 3:
        return "tavily_search"
    else:
        return "refine_query"


def route_hallucination(state: AgentState) -> str:
    if state["hallucination_pass"]:
        return "answer_grader"
    elif state["hallucination_retry_count"] >= 2:
        return "answer_grader"
    else:
        return "regenerate"


def route_answer(state: AgentState) -> str:
    if state["answer_score"] >= 4:
        return "source_citation"
    elif state["answer_retry_count"] >= 2:
        return "source_citation"
    else:
        return "query_rewriter"


def build_graph():
    """Build and compile the LangGraph pipeline"""

    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("query_analyzer", query_analyzer)
    workflow.add_node("query_rewriter", query_rewriter)
    workflow.add_node("multi_query_generator", multi_query_generator)
    workflow.add_node("retrieve_documents", retrieve_documents)
    workflow.add_node("grade_retrieval", grade_retrieval)
    workflow.add_node("refine_query", refine_query)
    workflow.add_node("tavily_search", tavily_search)
    workflow.add_node("reranker", reranker)
    workflow.add_node("context_builder", context_builder)
    workflow.add_node("answer_generator", answer_generator)
    workflow.add_node("hallucination_check", hallucination_check)
    workflow.add_node("regenerate", regenerate)
    workflow.add_node("answer_grader", answer_grader)
    workflow.add_node("source_citation", source_citation)
    workflow.add_node("final_response", final_response)
    workflow.add_node("chat_node", chat_node)
    workflow.add_node("web_search_node", web_search_node)
    workflow.add_node("summary_node", summary_node)

    # Entry point
    workflow.set_entry_point("query_analyzer")

    # Simple edges
    workflow.add_edge("query_rewriter", "multi_query_generator")
    workflow.add_edge("multi_query_generator", "retrieve_documents")
    workflow.add_edge("retrieve_documents", "grade_retrieval")
    workflow.add_edge("refine_query", "query_rewriter")
    workflow.add_edge("tavily_search", "reranker")
    workflow.add_edge("reranker", "context_builder")
    workflow.add_edge("context_builder", "answer_generator")
    workflow.add_edge("answer_generator", "hallucination_check")
    workflow.add_edge("regenerate", "hallucination_check")
    workflow.add_edge("source_citation", "final_response")
    workflow.add_edge("final_response", END)
    workflow.add_edge("summary_node", "final_response")
    workflow.add_edge("chat_node", "final_response")
    workflow.add_edge("web_search_node", "final_response")

    # Conditional edges
    workflow.add_conditional_edges("query_analyzer", route_query, {
        "chat_node": "chat_node",
        "web_search_node": "web_search_node",
        "summary_node": "summary_node",
        "query_rewriter": "query_rewriter"
    })

    workflow.add_conditional_edges("grade_retrieval", route_retrieval, {
        "reranker": "reranker",
        "tavily_search": "tavily_search",
        "refine_query": "refine_query"
    })

    workflow.add_conditional_edges("hallucination_check", route_hallucination, {
        "answer_grader": "answer_grader",
        "regenerate": "regenerate"
    })

    workflow.add_conditional_edges("answer_grader", route_answer, {
        "source_citation": "source_citation",
        "query_rewriter": "query_rewriter"
    })

    # Compile and return
    app = workflow.compile()
    return app


# Compile graph on import
app = build_graph()