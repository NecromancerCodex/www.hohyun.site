"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { getUserIdFromToken } from "@/lib/api/auth";
import {
  getRecentGroupChatMessages,
  sendGroupChatMessage,
  deleteAllGroupChatMessages,
  GroupChatMessage,
} from "@/lib/api/groupchat";

export default function GroupChatPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, restoreAuthState } = useLoginStore();
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  const userId = getUserIdFromToken(accessToken || undefined);

  // 인증 상태 복원 (새로고침 시)
  useEffect(() => {
    setIsHydrated(true);
    restoreAuthState();
  }, [restoreAuthState]);

  // 메시지 목록 로드
  const loadMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const response = await getRecentGroupChatMessages(100);
      if (response.code === 200 && Array.isArray(response.data)) {
        // 최신순이므로 역순으로 정렬 (오래된 것부터 표시)
        const sortedMessages = [...response.data].reverse();
        setMessages(sortedMessages);
        
        // 마지막 메시지 ID 저장
        if (sortedMessages.length > 0 && sortedMessages[sortedMessages.length - 1]?.id) {
          lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id || 0;
        }
      } else {
        setError(response.message || "메시지를 불러올 수 없습니다.");
      }
    } catch (err: any) {
      console.error("메시지 로드 오류:", err);
      setError(err.message || "메시지를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // SSE 연결 함수
  const connectSSE = () => {
    // 기존 연결이 있으면 닫기
    if (eventSourceRef.current) {
      console.log("[SSE] 기존 연결 종료");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.hohyun.site";
    const url = `${apiUrl}/api/groupchat/stream?lastId=${lastMessageIdRef.current}`;
    console.log("[SSE] 연결 시작:", url);
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[SSE] 연결 성공");
    };

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] 메시지 수신:", data);
        
        if (data.id) {
          // lastMessageId 업데이트
          if (data.id > lastMessageIdRef.current) {
            lastMessageIdRef.current = data.id;
          }

          // 새 메시지 추가 (카카오톡처럼 즉시 표시)
          setMessages((prev) => {
            // 중복 체크
            if (prev.some((msg) => msg.id === data.id)) {
              console.log("[SSE] 중복 메시지 무시:", data.id);
              return prev;
            }
            console.log("[SSE] 새 메시지 추가:", data.id);
            // 시간순으로 정렬하여 추가
            const newMessages = [...prev, data].sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeA - timeB;
            });
            return newMessages;
          });
        }
      } catch (err) {
        console.error("[SSE] 이벤트 파싱 오류:", err, event.data);
      }
    });

    eventSource.addEventListener("ping", () => {
      // keep-alive 이벤트
      console.log("[SSE] keep-alive ping");
    });

    eventSource.onerror = (err) => {
      const readyState = eventSource.readyState;
      console.error("[SSE] 연결 오류:", { readyState, err });
      
      // CLOSED 상태면 재연결 필요
      if (readyState === EventSource.CLOSED) {
        console.log("[SSE] 연결 종료됨, 3초 후 재연결 시도");
        eventSource.close();
        eventSourceRef.current = null;
        
        setTimeout(() => {
          if (eventSourceRef.current === null || eventSourceRef.current.readyState === EventSource.CLOSED) {
            console.log("[SSE] 재연결 시도");
            connectSSE();
          }
        }, 3000);
      }
    };
  };

  // 초기 로드 및 SSE 연결 (hydration 완료 후)
  useEffect(() => {
    if (!isHydrated) return;

    const initializeChat = async () => {
      // 초기 메시지 로드
      await loadMessages();
      // 메시지 로드 후 SSE 연결 시작
      connectSSE();
    };

    initializeChat();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isHydrated]); // hydration 완료 후 실행

  // 새 메시지가 추가될 때 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim()) return;

    if (!isAuthenticated || !accessToken) {
      setError("로그인 후 메시지를 보낼 수 있습니다.");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
      return;
    }

    const messageText = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendGroupChatMessage(messageText, accessToken);
      console.log("[메시지 전송] 응답:", response);
      
      if (response.code === 200 && response.data) {
        // 메시지 전송 성공 - 즉시 화면에 반영 (카카오톡처럼)
        // 백엔드에서 단일 객체를 반환하므로 직접 사용
        const newMessage = Array.isArray(response.data) ? response.data[0] : response.data as GroupChatMessage;
        console.log("[메시지 전송] 새 메시지:", newMessage);
        
        if (newMessage.id) {
          // lastMessageId 업데이트
          if (newMessage.id > lastMessageIdRef.current) {
            lastMessageIdRef.current = newMessage.id;
          }

          // 즉시 메시지 추가 (실시간 반영)
          setMessages((prev) => {
            // 중복 체크 (SSE가 나중에 같은 메시지를 보낼 수 있으므로)
            if (prev.some((msg) => msg.id === newMessage.id)) {
              console.log("[메시지 전송] 중복 메시지 무시:", newMessage.id);
              return prev; // 이미 있으면 중복 추가 방지
            }
            console.log("[메시지 전송] 새 메시지 즉시 추가:", newMessage.id);
            // 시간순으로 정렬하여 추가
            const newMessages = [...prev, newMessage].sort((a, b) => {
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeA - timeB;
            });
            return newMessages;
          });
        }
        
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        setError(response.message || "메시지 전송에 실패했습니다.");
        setInput(messageText); // 실패 시 입력 복원
      }
    } catch (err: any) {
      console.error("메시지 전송 오류:", err);
      setError(err.response?.data?.message || err.message || "메시지 전송 중 오류가 발생했습니다.");
      setInput(messageText); // 실패 시 입력 복원
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  // 시간 포맷팅
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "방금 전";
      if (diffMins < 60) return `${diffMins}분 전`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}일 전`;

      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const { logout } = useLoginStore();

  const handleLogout = async () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      await logout();
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
          <button
            onClick={() => router.push("/groupchat")}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-purple-400"
            title="단체 채팅"
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M13 8H7" />
              <path d="M17 12H7" />
            </svg>
            <span>단체 채팅</span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="로그아웃"
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
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-100 to-pink-100 border-b border-purple-200 px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                단체 채팅방
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                모든 사용자가 함께 대화하는 공간입니다
              </p>
            </div>
            {isAuthenticated && userId === "1" && (
              <button
                onClick={async () => {
                  if (window.confirm("모든 메시지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                    try {
                      if (!accessToken) {
                        setError("로그인이 필요합니다.");
                        return;
                      }
                      const response = await deleteAllGroupChatMessages(accessToken);
                      if (response.code === 200) {
                        setMessages([]);
                        lastMessageIdRef.current = 0;
                        // SSE 재연결
                        connectSSE();
                        alert(response.message);
                      } else {
                        setError(response.message || "삭제에 실패했습니다.");
                      }
                    } catch (err: any) {
                      console.error("메시지 삭제 오류:", err);
                      setError(err.response?.data?.message || err.message || "삭제 중 오류가 발생했습니다.");
                    }
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                전체 삭제
              </button>
            )}
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-purple-400 text-lg">메시지 불러오는 중...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-purple-400 text-lg mb-2">아직 메시지가 없습니다</div>
                <div className="text-gray-500 text-sm">첫 메시지를 보내보세요!</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((msg) => {
                const isMyMessage = msg.userId?.toString() === userId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMyMessage
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                          : "bg-white border border-gray-200 text-gray-800"
                      }`}
                    >
                      {!isMyMessage && (
                        <div className="text-xs font-semibold mb-1 text-gray-600">
                          {msg.username || `사용자 ${msg.userId}`}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {msg.message}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          isMyMessage ? "text-purple-100" : "text-gray-400"
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200">
            <div className="max-w-4xl mx-auto text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            {!isAuthenticated ? (
              <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-sm text-yellow-800">
                  로그인 후 메시지를 보낼 수 있습니다.
                </span>
                <button
                  onClick={() => router.push("/login")}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  로그인
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:bg-gray-100 text-gray-900 placeholder-gray-400 bg-white"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      전송 중...
                    </>
                  ) : (
                    <>
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
                      전송
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

