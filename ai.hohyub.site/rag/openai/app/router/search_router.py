"""Search routes for document retrieval."""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/retrieve", tags=["Search"])

# Global reference (will be set by main app)
vector_store = None


def set_dependencies(vs):
    """Set vector store dependency."""
    global vector_store
    vector_store = vs


@router.post("")
async def retrieve_documents(query: str, k: int = 3):
    """Retrieve similar documents.

    Args:
        query: Search query.
        k: Number of documents to retrieve.

    Returns:
        List of retrieved documents.
    """
    if not vector_store:
        raise HTTPException(status_code=500, detail="Vector store not initialized")

    docs = await vector_store.asimilarity_search_with_score(query, k=k)
    return {
        "query": query,
        "documents": [
            {"content": doc.page_content, "metadata": doc.metadata, "score": score}
            for doc, score in docs
        ],
    }

