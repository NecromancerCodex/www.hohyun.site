import chatApiClient from "./chatClient";

/**
 * AI 챗봇 API 함수들
 * 백엔드 게이트웨이 서버 (localhost:8080)를 통해 챗봇 서비스와 연동
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface ChatRequest {
  message: string;
  model?: string;
  system_message?: string;
  conversation_history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  conversationId?: string;
  history?: ChatMessage[]; // 하위 호환성을 위해 유지
  [key: string]: any;
}

export interface ChatResponse {
  message: string;
  model?: string;
  status?: string;
  success?: boolean;
  response?: string;
  conversationId?: string;
  error?: string;
  detail?: string;
  [key: string]: any;
}

/**
 * AI 챗봇 메시지 전송 (모델 선택 가능: OpenAI 또는 Llama)
 * 백엔드 엔드포인트: POST /rag/{model}/rag
 * 
 * @param request - 챗봇 요청 정보
 * @param request.message - 사용자 메시지 (필수)
 * @param request.model - 사용할 모델 ("openai" 또는 "llama", 기본값: "llama")
 * @param request.system_message - 시스템 메시지 (무시됨)
 * @param request.conversation_history - 대화 히스토리 (연속적인 대화를 위해 사용)
 */
export const sendChatMessage = async (
  request: ChatRequest
): Promise<ChatResponse> => {
  // 모델 선택 (기본값: llama)
  const model = request.model === "openai" ? "openai" : "llama";
  
  // conversation_history 형식 변환 (하위 호환성)
  let conversationHistory = request.conversation_history;
  
  // history 필드가 있으면 conversation_history로 변환
  if (!conversationHistory && request.history) {
    conversationHistory = request.history.map((msg) => ({
      role: msg.role === "system" ? "assistant" : msg.role,
      content: msg.content,
    }));
  }

  // RAG API 형식으로 변환
  const requestBody: any = {
    question: request.message,
    k: 3, // 검색할 문서 개수
  };

  // conversation_history가 있으면 추가
  if (conversationHistory && conversationHistory.length > 0) {
    requestBody.conversation_history = conversationHistory;
  }

  // 게이트웨이를 통해 선택된 RAG 서비스 호출
  const response = await chatApiClient.post<{
    question: string;
    answer: string;
    retrieved_documents?: any[];
    retrieved_count?: number;
  }>(
    `/rag/${model}/rag`,
    requestBody
  );
  
  // RAG 응답을 ChatResponse 형식으로 변환
  return {
    message: response.data.answer,
    response: response.data.answer,
    model: model,
    status: "success",
    success: true,
  };
};

/**
 * 스트리밍 방식으로 챗봇 메시지 전송 (SSE 또는 WebSocket)
 * TODO: 백엔드 스트리밍 API 구현 후 추가
 */
export const sendChatMessageStream = async (
  request: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<void> => {
  // SSE (Server-Sent Events) 방식으로 구현 예정
  // 또는 WebSocket 사용
  throw new Error("스트리밍 기능은 아직 구현되지 않았습니다.");
};

/**
 * 대화 기록 조회
 */
export const getConversationHistory = async (
  conversationId: string
): Promise<ChatMessage[]> => {
  const response = await chatApiClient.get<ChatMessage[]>(
    `/api/chat/conversation/${conversationId}`
  );
  return response.data;
};

/**
 * 대화 목록 조회
 */
export const getConversations = async (): Promise<any[]> => {
  const response = await chatApiClient.get<any[]>("/api/chat/conversations");
  return response.data;
};

/**
 * 대화 삭제
 */
export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  await chatApiClient.delete(`/api/chat/conversation/${conversationId}`);
};

/**
 * 챗봇 서버 상태 확인 (비활성화됨 - 헬스체크 로그 방지)
 * GET /chatbot/chat 엔드포인트를 사용하여 서버 상태 확인
 */
export const checkChatServerHealth = async (): Promise<boolean> => {
  // 헬스체크 비활성화 - 항상 true 반환 (로그 방지)
  return true;
  
  /* 비활성화된 코드
  try {
    // 백엔드 문서에 있는 테스트용 GET 엔드포인트 사용
    // 타임아웃을 짧게 설정하여 빠르게 확인
    const response = await chatApiClient.get<{ message?: string; model?: string; status?: string }>(
      "/chatbot/chat",
      { timeout: 5000 } // 5초 타임아웃
    );
    // 응답이 있으면 서버가 온라인
    return response.data !== null && response.data !== undefined;
  } catch (error: any) {
    // 네트워크 연결 에러가 아닌 경우 (예: 500 에러)는 서버가 온라인으로 간주
    // 실제로 서버에 연결할 수 있다는 의미이므로
    if (error.code !== "ECONNREFUSED" && error.code !== "CORS_ERROR" && !error.message?.includes("Failed to fetch")) {
      return true; // 서버는 실행 중이지만 다른 에러가 발생한 경우
    }
    // 네트워크 연결 실패는 오프라인
    return false;
  }
  */
};

