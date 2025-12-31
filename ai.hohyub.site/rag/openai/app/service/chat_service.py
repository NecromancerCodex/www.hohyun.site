"""
😎😎 chat_service.py 서빙 관련 서비스 (OpenAI 전용)

OpenAI GPT 모델을 사용한 채팅/대화형 LLM 인터페이스.

세션별 히스토리 관리, 요약, 토큰 절약 전략 등.
"""

import os
from typing import Any, List, Optional, cast

from langchain_core.documents import Document
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI
from langchain_postgres import PGVector


def init_llm() -> BaseChatModel:
    """Initialize OpenAI LLM.

    Returns:
        ChatOpenAI instance.

    Raises:
        ValueError: If API key is not provided.
    """
    print("\n" + "=" * 60)
    print("[CHAT_SERVICE] 🚀 init_llm() called - Starting OpenAI LLM initialization")
    print("=" * 60)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY in .env file.")

    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))
    max_tokens_str = os.getenv("OPENAI_MAX_TOKENS", "0")
    max_tokens = (
        int(max_tokens_str) if max_tokens_str and max_tokens_str != "0" else None
    )

    print(f"[CHAT_SERVICE] Model: {model_name}")
    print(f"[CHAT_SERVICE] Temperature: {temperature}")
    if max_tokens:
        print(f"[CHAT_SERVICE] Max tokens: {max_tokens}")

    # ChatOpenAI kwargs
    kwargs: dict[str, Any] = {
        "model": model_name,
        "temperature": temperature,
        "api_key": api_key,
    }

    # max_tokens는 선택적 파라미터 (max_completion_tokens로 전달)
    if max_tokens is not None:
        kwargs["max_completion_tokens"] = max_tokens

    llm = ChatOpenAI(**kwargs)

    print("[CHAT_SERVICE] ✅ OpenAI LLM initialized successfully!")
    print("=" * 60 + "\n")
    return llm


def create_rag_chain(vector_store: PGVector, llm: BaseChatModel) -> Runnable:
    """Create RAG chain with retriever and OpenAI LLM.

    Args:
        vector_store: PGVector instance for document retrieval.
        llm: ChatOpenAI instance for generation.

    Returns:
        RAG chain (runnable).
    """
    print("\n" + "=" * 60)
    print("[CHAT_SERVICE] 🔗 create_rag_chain() called")
    print(f"[CHAT_SERVICE]   - vector_store type: {type(vector_store).__name__}")
    print(f"[CHAT_SERVICE]   - llm type: {type(llm).__name__}")
    print("=" * 60)

    # ChatPromptTemplate을 사용하여 자연스러운 대화 모드 구성
    # 시스템 메시지 없이 자연스러운 대화 흐름 유지
    prompt = ChatPromptTemplate.from_messages(
        [
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{question}"),
        ]
    )

    def format_docs(docs: List[Document]) -> str:
        return "\n\n".join(doc.page_content for doc in docs)

    def format_history(history: Optional[List[dict]]) -> List[BaseMessage]:
        """Convert history dict list to LangChain messages."""
        if not history or len(history) == 0:
            return []

        # 최근 10개 대화만 포함 (토큰 제한 고려)
        recent_history = history[-10:] if len(history) > 10 else history

        messages: List[BaseMessage] = cast(List[BaseMessage], [])
        for msg in recent_history:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

        return messages

    def create_rag_input(input_data: dict) -> dict:
        """Create input for RAG chain with history.

        Note: Retriever is called separately in the router to support async_mode.
        """
        print("[CHAT_SERVICE] 📥 create_rag_input() called")
        print(f"[CHAT_SERVICE]   - question: {input_data.get('question', '')[:50]}...")
        print(
            f"[CHAT_SERVICE]   - history length: {len(input_data.get('history', []))}"
        )
        print(
            f"[CHAT_SERVICE]   - context length: {len(input_data.get('context', ''))}"
        )
        question = input_data.get("question", "")
        history = input_data.get("history", None)
        context = input_data.get("context", "").strip()

        # 히스토리를 LangChain 메시지로 변환
        chat_history = format_history(history)

        # 컨텍스트가 있으면 자연스럽게 질문에 포함
        if context:
            formatted_question = f"{context}\n\n{question}"
        else:
            formatted_question = question

        return {
            "chat_history": chat_history,
            "question": formatted_question,
        }

    rag_chain: Runnable = create_rag_input | prompt | llm | StrOutputParser()

    print("[CHAT_SERVICE] ✅ create_rag_chain() completed - Returning RAG chain")
    print("=" * 60 + "\n")
    return rag_chain
