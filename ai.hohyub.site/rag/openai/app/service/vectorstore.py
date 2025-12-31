"""Vector store initialization for PGVector."""

import os

from langchain_postgres import PGVector
from langchain_postgres.vectorstores import PGVector as PGVectorType
from langchain_huggingface import HuggingFaceEmbeddings


async def init_vector_store() -> PGVectorType:
    """Initialize PGVector vector store.

    Returns:
        PGVector instance.

    Raises:
        ValueError: If DATABASE_URL or COLLECTION_NAME is not set.
    """
    database_url = os.getenv("DATABASE_URL")
    collection_name = os.getenv("COLLECTION_NAME", "rag_collection")

    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")

    # Use psycopg (async) instead of asyncpg to support multi-statement SQL
    # psycopg3 is more compatible with langchain_postgres
    if database_url.startswith("postgresql://"):
        if "+asyncpg" in database_url:
            database_url = database_url.replace("+asyncpg", "+psycopg")
        else:
            database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        print(f"✅ Converted DATABASE_URL to use psycopg for async support")

    # psycopg supports standard PostgreSQL connection parameters
    # No need to convert sslmode or channel_binding
    print(f"ℹ️  Using psycopg driver (supports multi-statement SQL)")

    # Initialize embedding model using HuggingFace embeddings
    # This provides the async interface that PGVector expects
    embedding_model = HuggingFaceEmbeddings(
        model_name="jhgan/ko-sroberta-multitask",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )
    print("✅ Loaded embedding model: jhgan/ko-sroberta-multitask")

    # Create PGVector instance using connection parameter
    # Latest langchain-postgres uses 'connection' instead of 'connection_string'
    vector_store = await PGVector.afrom_existing_index(
        embedding=embedding_model,
        connection=database_url,  # Changed from connection_string to connection
        collection_name=collection_name,
        pre_delete_collection=False,  # Don't try to recreate
    )

    return vector_store

