"""FastAPI server for RAG with OpenAI GPT models and pgvector."""

import asyncio
import os
import sys
from contextlib import asynccontextmanager

# Fix for Windows: psycopg requires SelectorEventLoop, not ProactorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from router import chat_router, search_router  # type: ignore
from service.chat_service import create_rag_chain, init_llm  # type: ignore
from service.vectorstore import init_vector_store  # type: ignore

# Load environment variables
# Priority: 1. Local .env (for EC2 deployment), 2. Project root .env (for local development)
current_dir = os.path.dirname(__file__)  # openai/app
local_env = os.path.join(current_dir, ".env")

# Try local .env first (for EC2 deployment)
if os.path.exists(local_env):
    load_dotenv(local_env)
    print(f"✅ Loaded .env from local: {local_env}")
else:
    # Fallback to project root .env (for local development)
    project_root = os.path.dirname(os.path.dirname(current_dir))  # langchain
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded .env from project root: {env_path}")
    else:
        print(f"⚠️  No .env file found. Tried: {local_env} and {env_path}")

# Verify required environment variables
required_vars = ["DATABASE_URL", "OPENAI_API_KEY"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    print(f"⚠️  WARNING: Missing environment variables: {', '.join(missing_vars)}")
    print(f"⚠️  Please create .env file in {os.path.dirname(__file__)}")
    print("⚠️  Required variables:")
    for var in required_vars:
        print(f"   - {var}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    try:
        print("Initializing vector store...")
        vector_store = await init_vector_store()
        print("[OK] Vector store initialized!")

        print("Initializing OpenAI LLM...")
        llm = init_llm()

        print("Creating RAG chain...")
        rag_chain_instance = create_rag_chain(vector_store, llm)
        print("[OK] RAG chain initialized!")

        # Set dependencies for routers
        chat_router.set_dependencies(vector_store, rag_chain_instance)
        search_router.set_dependencies(vector_store)

        print("API server is ready!")
    except Exception as e:
        print(f"[ERROR] Startup error: {e}")
        import traceback

        traceback.print_exc()
        raise

    yield

    # Shutdown (if needed)
    print("Shutting down...")


app = FastAPI(title="RAG API Server (OpenAI)", version="1.0.0", lifespan=lifespan)

# CORS 설정
# 환경 변수에서 허용할 origin 목록 가져오기
# 기본값: hohyun.site 포함 (프로덕션에서는 명시적으로 지정 권장)
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "https://hohyun.site,https://www.hohyun.site,http://localhost:3000"
)
if allowed_origins_str == "*":
    allowed_origins = ["*"]
else:
    # 쉼표로 구분된 여러 URL 지원
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

print(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # OPTIONS 명시적 허용 (preflight)
    allow_headers=["*"],
    expose_headers=["*"],  # 모든 헤더 노출
)


# Include routers
app.include_router(chat_router.router)
app.include_router(search_router.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "RAG API Server (OpenAI)",
        "version": "1.0.0",
        "llm_provider": "openai",
        "endpoints": {
            "rag": "POST /rag - RAG (Retrieval + Generation)",
            "retrieve": "POST /retrieve - Retrieve similar documents",
            "add_document": "POST /documents - Add a document",
            "add_documents": "POST /documents/batch - Add multiple documents",
            "health": "GET /health - Health check",
        },
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "llm_provider": "openai",
        "vector_store": "initialized"
        if search_router.vector_store
        else "not initialized",
        "rag_chain": "initialized" if chat_router.rag_chain else "not initialized",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
