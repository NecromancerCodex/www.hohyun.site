"""통합 RAG 서비스 FastAPI 애플리케이션
OpenAI와 Llama RAG 서비스를 하나의 포트로 통합
"""

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Fix for Windows: psycopg requires SelectorEventLoop, not ProactorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 프로젝트 루트를 Python path에 추가
# main.py가 rag/ 폴더에 직접 있으므로 parent가 rag 폴더
project_root = Path(__file__).parent.absolute()
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 환경 변수 로드
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ Loaded .env from: {env_path}")
else:
    print(f"⚠️  No .env file found at: {env_path}")

# 서비스 가용성 플래그
OPENAI_AVAILABLE = False
LLAMA_AVAILABLE = False

# RAG OpenAI 라우터 import
try:
    # app/main.py -> rag/ -> ai.hohyub.site/rag/openai/app
    openai_app_path = project_root / "openai" / "app"
    sys.path.insert(0, str(openai_app_path))
    from router import chat_router as openai_chat_router, search_router as openai_search_router
    from service.chat_service import create_rag_chain as create_openai_rag_chain, init_llm as init_openai_llm
    from service.vectorstore import init_vector_store as init_openai_vector_store
    OPENAI_AVAILABLE = True
    print("✅ OpenAI RAG 모듈 로드 완료")
except Exception as e:
    print(f"⚠️  OpenAI RAG 서비스 로드 실패: {e}")
    import traceback
    traceback.print_exc()
    openai_chat_router = None
    openai_search_router = None
    init_openai_vector_store = None
    create_openai_rag_chain = None
    init_openai_llm = None

# RAG Llama 라우터 import
try:
    # app/main.py -> rag/ -> ai.hohyub.site/rag/llama/app
    llama_app_path = project_root / "llama" / "app"
    sys.path.insert(0, str(llama_app_path))
    from router import chat_router as llama_chat_router
    from service.chat_service import create_rag_chain as create_llama_rag_chain, init_llm as init_llama_llm
    # Llama vectorstore 초기화 함수 찾기
    try:
        from core.vectorstore import init_vector_store as init_llama_vector_store
    except:
        # core.vectorstore가 없으면 직접 PGVector 생성
        init_llama_vector_store = None
    LLAMA_AVAILABLE = True
    print("✅ Llama RAG 모듈 로드 완료")
except Exception as e:
    print(f"⚠️  Llama RAG 서비스 로드 실패: {e}")
    import traceback
    traceback.print_exc()
    llama_chat_router = None
    create_llama_rag_chain = None
    init_llama_llm = None
    init_llama_vector_store = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    try:
        # OpenAI RAG 초기화
        if OPENAI_AVAILABLE and init_openai_vector_store:
            print("Initializing OpenAI RAG...")
            try:
                openai_vector_store = await init_openai_vector_store()
                openai_llm = init_openai_llm()
                openai_rag_chain = create_openai_rag_chain(openai_vector_store, openai_llm)
                if openai_chat_router:
                    openai_chat_router.set_dependencies(openai_vector_store, openai_rag_chain)
                if openai_search_router:
                    openai_search_router.set_dependencies(openai_vector_store)
                print("[OK] OpenAI RAG initialized!")
            except Exception as e:
                print(f"[ERROR] OpenAI RAG initialization failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Llama RAG 초기화
        if LLAMA_AVAILABLE and init_llama_vector_store:
            print("Initializing Llama RAG...")
            try:
                llama_vector_store = await init_llama_vector_store()
                llama_llm = init_llama_llm()
                llama_rag_chain = create_llama_rag_chain(llama_vector_store, llama_llm)
                if llama_chat_router:
                    llama_chat_router.set_dependencies(llama_vector_store, llama_rag_chain)
                print("[OK] Llama RAG initialized!")
            except Exception as e:
                print(f"[ERROR] Llama RAG initialization failed: {e}")
                import traceback
                traceback.print_exc()
        
        print("✅ All RAG services initialized!")
    except Exception as e:
        print(f"[ERROR] Startup error: {e}")
        import traceback
        traceback.print_exc()
        raise

    yield

    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title="RAG Service Platform",
    description="통합 RAG 서비스 플랫폼 - OpenAI 및 Llama",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5000,http://localhost:7000,http://127.0.0.1:3000,http://127.0.0.1:5000,http://127.0.0.1:7000"
)
if allowed_origins_str == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

print(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# RAG OpenAI 라우터 포함
if OPENAI_AVAILABLE and openai_chat_router:
    app.include_router(openai_chat_router.router, prefix="/rag/openai", tags=["RAG OpenAI"])
if OPENAI_AVAILABLE and openai_search_router:
    app.include_router(openai_search_router.router, prefix="/rag/openai", tags=["RAG OpenAI"])

# RAG Llama 라우터 포함
if LLAMA_AVAILABLE and llama_chat_router:
    app.include_router(llama_chat_router.router, prefix="/rag/llama", tags=["RAG Llama"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "RAG Service Platform",
        "version": "1.0.0",
        "services": {
            "rag_openai": "available" if OPENAI_AVAILABLE else "unavailable",
            "rag_llama": "available" if LLAMA_AVAILABLE else "unavailable",
        },
        "endpoints": {
            "rag_openai": {
                "rag": "POST /rag/openai/rag",
                "retrieve": "POST /rag/openai/retrieve",
            },
            "rag_llama": {
                "rag": "POST /rag/llama/rag",
            },
            "health": "GET /health",
        },
    }


@app.get("/health")
async def health():
    """통합 헬스체크"""
    return {
        "status": "healthy",
        "services": {
            "rag_openai": "initialized" if OPENAI_AVAILABLE else "unavailable",
            "rag_llama": "initialized" if LLAMA_AVAILABLE else "unavailable",
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

