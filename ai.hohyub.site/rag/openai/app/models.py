"""API request/response models."""

from typing import Any, List, Optional

from pydantic import BaseModel


class QueryRequest(BaseModel):
    """RAG query request model."""

    question: str
    k: int = 3
    conversation_history: Optional[List[dict[str, Any]]] = None


class RAGResponse(BaseModel):
    """RAG response model."""

    question: str
    answer: str
    retrieved_documents: List[dict[str, Any]]
    retrieved_count: int

