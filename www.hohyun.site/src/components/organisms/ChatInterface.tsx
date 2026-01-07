"use client";

import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage, ChatMessage, checkChatServerHealth } from "@/lib/api/chat";
import { useLoginStore } from "@/store";
import { getUserIdFromToken } from "@/lib/api/auth";
import { useRouter } from "next/navigation";
import { getAbout, saveAbout, updateAbout, About } from "@/lib/api/about";
// 직접 감정 분석 호출 제거 - 일기 저장 시 백엔드에서 자동 분석

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// localStorage 키 생성 (사용자별)
const getChatMessagesKey = (userId: string | null): string => {
  if (!userId) return "chat_messages_anonymous";
  return `chat_messages_${userId}`;
};

// localStorage에서 메시지 복원 (사용자별)
const loadMessagesFromStorage = (userId: string | null): Message[] => {
  if (typeof window === "undefined") return [];
  
  try {
    const key = getChatMessagesKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // timestamp를 Date 객체로 변환
    return parsed.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error("Failed to load messages from storage:", error);
    return [];
  }
};

// localStorage에 메시지 저장 (사용자별)
const saveMessagesToStorage = (messages: Message[], userId: string | null): void => {
  if (typeof window === "undefined") return;
  
  try {
    const key = getChatMessagesKey(userId);
    // Date 객체를 문자열로 변환하여 저장
    const serialized = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to save messages to storage:", error);
  }
};

export const ChatInterface: React.FC = () => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline" | null>(null);
  const [selectedModel, setSelectedModel] = useState<"openai" | "llama">("llama"); // 기본값: llama
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { logout, isAuthenticated, accessToken } = useLoginStore();
  
  // 자기소개글 관련 상태
  const [about, setAbout] = useState<About | null>(null);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutContent, setAboutContent] = useState("");
  const [isLoadingAbout, setIsLoadingAbout] = useState(false);

  // 사용자 ID 가져오기 (accessToken에서 추출)
  const userId = getUserIdFromToken(accessToken || undefined);
  const isOwner = userId === "1"; // userId 1만 편집 권한 (string 비교)
  
  // 모델 선택을 localStorage에 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem(`chat_model_${userId || "anonymous"}`) as "openai" | "llama" | null;
      if (savedModel === "openai" || savedModel === "llama") {
        setSelectedModel(savedModel);
      }
    }
  }, [userId]);
  
  // 모델 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`chat_model_${userId || "anonymous"}`, selectedModel);
    }
  }, [selectedModel, userId]);

  // 컴포넌트 마운트 시 localStorage에서 메시지 복원 (사용자별)
  useEffect(() => {
    const savedMessages = loadMessagesFromStorage(userId);
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    }
  }, [userId]);

  // 메시지가 변경될 때마다 localStorage에 저장 (사용자별)
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages, userId);
    }
  }, [messages, userId]);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 입력 필드 포커스 유지
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 로딩 상태가 변경될 때마다 포커스 유지
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      // 약간의 지연 후 포커스 복원 (DOM 업데이트 후)
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const loadAbout = async () => {
    try {
      setIsLoadingAbout(true);
      const aboutData = await getAbout();
      setAbout(aboutData);
      if (aboutData) {
        setAboutContent(aboutData.content);
      }
    } catch (error) {
      console.error("[ChatInterface] 자기소개글 로드 실패:", error);
    } finally {
      setIsLoadingAbout(false);
    }
  };

  const handleSaveAbout = async () => {
    try {
      setIsLoadingAbout(true);
      if (about) {
        // 수정
        const updated = await updateAbout(aboutContent);
        setAbout(updated);
      } else {
        // 생성
        const created = await saveAbout(aboutContent);
        setAbout(created);
      }
      setIsEditingAbout(false);
    } catch (error) {
      console.error("[ChatInterface] 자기소개글 저장 실패:", error);
      alert("자기소개글 저장에 실패했습니다.");
    } finally {
      setIsLoadingAbout(false);
    }
  };

  const handleCancelEditAbout = () => {
    if (about) {
      setAboutContent(about.content);
    } else {
      setAboutContent("");
    }
    setIsEditingAbout(false);
  };

  // 자기소개글 로드 (게스트 포함 모두 조회 가능)
  useEffect(() => {
    loadAbout(); // 인증 여부와 관계없이 항상 로드
  }, []); // 빈 의존성 배열: 컴포넌트 마운트 시 1회만 실행

  // 서버 상태 확인
  useEffect(() => {
    const checkServer = async () => {
      setServerStatus("checking");
      try {
        const isOnline = await checkChatServerHealth();
        setServerStatus(isOnline ? "online" : "offline");
      } catch (error) {
        // 에러 발생 시 오프라인으로 표시
        setServerStatus("offline");
      }
    };
    
    checkServer();
    
    // 주기적으로 서버 상태 확인 (30초마다)
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // 일기 내용 추출 함수
  const extractDiaryContent = (messages: Message[]): string | null => {
    // 최근 메시지들에서 일기 형식 찾기 ([날짜] 일기 제목 내용)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user" && msg.content.includes("일기")) {
        const content = msg.content;
        
        // 일기 형식 1: [날짜] 일기 제목 내용
        const diaryMatch1 = content.match(/\[.*?\]\s*일기\s+([\s\S]+?)(?:\n|$)/);
        if (diaryMatch1) {
          const afterTitle = diaryMatch1[1];
          // 제목 다음 줄부터 내용 추출
          const lines = afterTitle.split('\n');
          if (lines.length > 1) {
            return lines.slice(1).join('\n').trim();
          }
          return afterTitle.trim();
        }
        
        // 일기 형식 2: 일기 제목이 있는 경우
        const lines = content.split('\n');
        const diaryIndex = lines.findIndex(line => line.includes('일기'));
        if (diaryIndex >= 0) {
          // 일기 라인 다음부터 내용 추출
          const afterDiaryLine = lines.slice(diaryIndex + 1).join('\n').trim();
          if (afterDiaryLine) {
            return afterDiaryLine;
          }
        }
        
        // 일기 형식 3: 일기 키워드가 포함된 전체 내용
        if (content.length > 10) {
          return content;
        }
      }
    }
    return null;
  };

  // 기분 관련 질문 감지
  const isMoodQuestion = (message: string): boolean => {
    const moodKeywords = ['기분', '감정', '느낌', '어떤 기분', '어떤 감정', '어떤 느낌'];
    return moodKeywords.some(keyword => message.includes(keyword));
  };

  // 감정 라벨을 한글로 변환
  const getEmotionLabelKorean = (label: string): string => {
    const labelMap: Record<string, string> = {
      '평가불가': '평범',
      '기쁨': '기쁨',
      '슬픔': '슬픔',
      '분노': '분노',
      '두려움': '두려움',
      '혐오': '혐오',
      '놀람': '놀람',
      '신뢰': '신뢰',
      '기대': '기대',
      '불안': '불안',
      '안도': '안도',
      '후회': '후회',
      '그리움': '그리움',
      '감사': '감사',
      '외로움': '외로움',
    };
    return labelMap[label] || label;
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // 사용자 메시지 추가
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    setIsLoading(true);

    try {
      // 기분 관련 질문 처리 - 직접 감정 분석 호출 제거
      // 감정 분석은 일기를 저장할 때 백엔드에서 자동으로 수행됩니다.
      let emotionAnalysis: string = "";
      if (isMoodQuestion(userMessage)) {
        emotionAnalysis = `\n\n📊 감정 분석:\n일기를 저장하면 자동으로 감정 분석 결과를 확인할 수 있습니다.`;
      }

      // 대화 히스토리 생성 (백엔드 API 형식에 맞춤)
      const conversationHistory = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      const response = await sendChatMessage({
        message: userMessage,
        model: selectedModel, // 선택된 모델 사용
        system_message: "You are a helpful assistant. Respond in Korean.",
        conversation_history: conversationHistory,
      });

      // 응답 메시지에 감정 분석 결과 추가
      const responseContent = response.message || response.response || "응답을 받을 수 없었습니다.";
      const finalContent = emotionAnalysis ? responseContent + emotionAnalysis : responseContent;

      // 응답 메시지 추가
      const assistantMessage: Message = {
        role: "assistant",
        content: finalContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      
      // 사용자 친화적인 에러 메시지 추출
      let errorMessage = "메시지를 전송하는 중 오류가 발생했습니다.";
      let errorTitle = "오류 발생";
      
      if (err.userMessage) {
        errorMessage = err.userMessage;
      } else if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        
        // OpenAI 할당량 초과 에러
        if (typeof detail === 'string' && (
          detail.includes('insufficient_quota') || 
          detail.includes('quota') || 
          detail.includes('exceeded your current quota')
        )) {
          errorTitle = "API 할당량 초과";
          errorMessage = "OpenAI API 사용 할당량이 초과되었습니다.\n\n관리자에게 문의하여 API 할당량을 확인하거나 결제 정보를 업데이트해주세요.";
        }
        // OpenAI API 키 에러
        else if (typeof detail === 'string' && detail.includes('API key')) {
          errorTitle = "API 키 오류";
          errorMessage = "OpenAI API 키가 설정되지 않았습니다.\n\n관리자에게 문의하여 API 키 설정을 확인해주세요.";
        }
        // 기타 OpenAI 에러
        else if (typeof detail === 'string' && detail.includes('OpenAI')) {
          errorTitle = "OpenAI API 오류";
          errorMessage = detail;
        }
        else {
          errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // 에러 메시지도 표시
      const errorMsg: Message = {
        role: "assistant",
        content: `❌ ${errorTitle}\n\n${errorMessage}\n\n${err.code === "OPENAI_QUOTA_EXCEEDED" ? "관리자에게 문의해주세요." : "잠시 후 다시 시도해주세요."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      // 포커스 복원을 약간의 지연 후 수행하여 확실히 적용
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      await handleSend();
      // Enter 키 입력 후 포커스 유지
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      await logout();
    }
  };

  const handleClearChat = () => {
    if (window.confirm("대화를 초기화하시겠습니까?")) {
      setMessages([]);
      setError(null);
      // localStorage에서도 삭제 (사용자별)
      if (typeof window !== "undefined") {
        const key = getChatMessagesKey(userId);
        localStorage.removeItem(key);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar Menu */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            hohyun
          </h1>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => router.push("/generate")}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg"
            title="이미지 생성"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M2 12h20" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>이미지 생성</span>
          </button>
          <button
            onClick={() => router.push("/yolo")}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg"
            title="YOLO 업로드"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>YOLO 업로드</span>
          </button>
          <button
            onClick={() => router.push("/history")}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg"
            title="역사기록"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            <span>역사기록</span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="대화 초기화"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              <span>초기화</span>
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>로그아웃</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0 gap-4">
        {/* Left: Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 max-w-4xl">
          {/* Header */}
          <header className="w-full border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="w-full px-6 py-4 flex items-center justify-end">
              {/* Server Status */}
              {serverStatus && (
                <div className="flex items-center gap-2">
                  {serverStatus === "checking" && (
                    <span className="text-xs text-gray-500">서버 확인 중...</span>
                  )}
                  {serverStatus === "online" && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      서버 연결됨
                    </span>
                  )}
                  {serverStatus === "offline" && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      서버 연결 안 됨
                    </span>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-8 relative">
            <div className="w-full">
              <div className="max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">무엇을 알고 싶으세요?</h2>
              <p className="text-gray-500 text-lg">질문을 입력하면 AI가 답변해드립니다.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white/95 backdrop-blur-sm">
            <div className="w-full px-6 py-6">
              {/* Input Field with Model Selection */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleSend(e);
                  // 메시지 전송 후 포커스 유지
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 50);
                }} 
                className="relative"
              >
                <div className="flex items-center gap-3 w-full max-w-3xl">
              {/* Model Selection Dropdown */}
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as "openai" | "llama")}
                  className="appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:border-purple-400 focus:outline-none transition-all cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="llama">Llama</option>
                  <option value="openai">OpenAI</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Input */}
              <div className="flex-1 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-2xl px-5 py-4 focus-within:border-purple-400 focus-within:shadow-lg focus-within:shadow-purple-100 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="무엇이든 물어보세요"
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400 bg-transparent text-base"
                  readOnly={isLoading}
                  autoFocus
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    input.trim() && !isLoading
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                  aria-label="전송"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600 px-2 text-center w-full">{error}</div>
            )}
          </form>
            </div>
          </div>
        </div>

        {/* Right: 자기소개 영역 - 게스트 포함 모두 조회 가능 */}
        <aside className="w-[750px] min-w-[700px] mr-4 my-4 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 border border-purple-200 rounded-2xl flex flex-col sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto shadow-lg">
          <div className="p-5 border-b border-purple-200 bg-white/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                자기소개
              </h2>
              {!isEditingAbout && isAuthenticated && isOwner && (
                <button
                  onClick={() => setIsEditingAbout(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  {about ? "수정" : "작성"}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-5">
            {isEditingAbout && isOwner ? (
                <div className="space-y-4">
                  <textarea
                    value={aboutContent}
                    onChange={(e) => setAboutContent(e.target.value)}
                    placeholder="자기소개를 입력하세요..."
                    className="w-full px-4 py-3 text-base border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none bg-white shadow-sm"
                    style={{ minHeight: '675px' }}
                    disabled={isLoadingAbout}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveAbout}
                      disabled={isLoadingAbout}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      {isLoadingAbout ? "저장 중..." : "저장"}
                    </button>
                    <button
                      onClick={handleCancelEditAbout}
                      disabled={isLoadingAbout}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-lg transition-all disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-base text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                  {isLoadingAbout ? (
                    <div className="flex items-center justify-center py-32">
                      <div className="text-purple-400 text-lg">로딩 중...</div>
                    </div>
                  ) : about ? (
                    about.content || (
                      <div className="text-purple-400 italic text-center py-32 text-lg">
                        자기소개가 없습니다.
                      </div>
                    )
                  ) : (
                    <div className="text-purple-400 italic text-center py-32 text-lg">
                      자기소개를 작성해보세요.
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
      </div>
    </div>
  );
};

