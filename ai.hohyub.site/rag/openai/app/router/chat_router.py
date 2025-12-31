"""
😎😎 FastAPI 기준의 API 엔드포인트 계층입니다 (OpenAI 전용).

chat_router.py
POST /api/chat
세션 ID, 메시지 리스트 등을 받아 대화형 응답 반환.
"""

import asyncio

from fastapi import APIRouter, HTTPException
from models import QueryRequest, RAGResponse  # type: ignore
from sqlalchemy.exc import DisconnectionError, OperationalError

router = APIRouter(prefix="/rag", tags=["RAG"])

# Global references (will be set by main app)
vector_store = None
rag_chain = None


def set_dependencies(vs, chain):
    """Set vector store and RAG chain dependencies."""
    global vector_store, rag_chain
    vector_store = vs
    rag_chain = chain


@router.post("", response_model=RAGResponse)
async def rag_query(request: QueryRequest):
    """RAG (Retrieval-Augmented Generation) - 검색 + 답변 생성.

    Args:
        request: Query request with question and k.

    Returns:
        RAG response with answer and retrieved documents.
    """
    if not rag_chain:
        raise HTTPException(status_code=500, detail="RAG chain not initialized")

    try:
        if not vector_store:
            raise HTTPException(status_code=500, detail="Vector store not initialized")

        print(f"[RAG] Received question: {request.question}, k={request.k}")

        # Retrieve documents with similarity scores (async) with retry logic
        max_retries = 3
        retry_delay = 1.0  # seconds

        retrieved_docs_with_scores = None

        for attempt in range(max_retries):
            try:
                print(
                    f"[RAG] 🔍 Attempting to retrieve documents (attempt {attempt + 1}/{max_retries})..."
                )
                retrieved_docs_with_scores = (
                    await vector_store.asimilarity_search_with_score(
                        request.question, k=request.k
                    )
                )
                print("[RAG] ✅ Successfully retrieved documents")
                break  # Success, exit retry loop
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__

                # Check if it's a connection-related error
                is_connection_error = (
                    "connection is closed" in error_msg.lower()
                    or "connection" in error_msg.lower()
                    and "closed" in error_msg.lower()
                    or isinstance(e, (OperationalError, DisconnectionError))
                    or "InterfaceError" in error_type
                    or "psycopg" in error_type.lower()
                )

                if is_connection_error:
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (attempt + 1)  # Exponential backoff
                        print(
                            f"[RAG] ⚠️  Connection error (attempt {attempt + 1}/{max_retries}): {error_type}"
                        )
                        print(f"[RAG] ⚠️  Error message: {error_msg[:150]}")
                        print(f"[RAG] 🔄 Retrying in {wait_time:.1f} seconds...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        print(
                            f"[RAG] ❌ Connection failed after {max_retries} attempts"
                        )
                        print(f"[RAG] ❌ Final error: {error_type}: {error_msg[:200]}")
                        raise HTTPException(
                            status_code=503,
                            detail=f"Database connection error after {max_retries} retries. Please try again.",
                        )
                else:
                    # Non-connection error, don't retry
                    print(
                        f"[RAG] ❌ Non-connection error: {error_type}: {error_msg[:200]}"
                    )
                    raise

        if retrieved_docs_with_scores is None:
            raise HTTPException(
                status_code=503, detail="Failed to retrieve documents after retries"
            )

        # PGVector returns list of (Document, score) tuples
        # Filter documents by relevance threshold
        relevance_threshold = 0.8
        retrieved_docs = [
            doc
            for doc, score in retrieved_docs_with_scores
            if score < relevance_threshold  # Lower score = more similar in pgvector
        ]

        print(
            f"[RAG] Retrieved {len(retrieved_docs)} relevant documents (threshold: {relevance_threshold})"
        )

        # Generate answer with conversation history
        print("[RAG] Generating answer...")
        history = request.conversation_history or []
        print(f"[RAG] Conversation history: {len(history)} messages")

        # Format context from retrieved documents
        context = "\n\n".join(doc.page_content for doc in retrieved_docs)

        # Prepare input with history and context
        chain_input = {
            "question": request.question,
            "history": history,
            "context": context,
        }
        # Use async invoke for async mode
        answer: str = str(await rag_chain.ainvoke(chain_input))

        # 기본 공백 정리만 수행
        answer = answer.strip()

        answer_preview: str = answer[:100] if len(answer) > 100 else answer
        print(f"[RAG] Answer generated: {answer_preview}...")

        return RAGResponse(
            question=request.question,
            answer=answer,
            retrieved_documents=[
                {
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in retrieved_docs
            ],
            retrieved_count=len(retrieved_docs),
        )
    except Exception as e:
        print(f"[RAG] Error: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
