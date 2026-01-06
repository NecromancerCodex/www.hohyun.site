"use client";

import React, { ReactNode, useEffect } from "react";
import { QueryProvider } from "./QueryProvider";
import { StoreProvider } from "./StoreProvider";

interface AppProviderProps {
  children: ReactNode;
}

/**
 * 모든 Provider를 통합하는 최상위 Provider
 * 의존성 주입 순서:
 * 1. QueryProvider (React Query)
 * 2. DependencyProvider (의존성 주입 컨테이너)
 * 3. StoreProvider (Zustand stores)
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  useEffect(() => {
    // 브라우저 확장 프로그램 관련 에러 무시
    // "message channel closed" 에러는 확장 프로그램과의 통신 실패로 발생하며
    // 앱 동작에는 영향을 주지 않으므로 무시합니다.
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason || "");
      const errorString = String(event.reason || "");
      
      // 브라우저 확장 프로그램 관련 에러 무시
      if (
        errorMessage.includes("message channel closed") ||
        errorMessage.includes("listener indicated an asynchronous response") ||
        errorMessage.includes("Extension context invalidated") ||
        errorString.includes("message channel closed") ||
        errorString.includes("listener indicated an asynchronous response")
      ) {
        event.preventDefault(); // 에러를 콘솔에 표시하지 않음
        if (process.env.NODE_ENV === "development") {
          console.debug("[Ignored] Browser extension error (suppressed):", errorMessage);
        }
        return;
      }
      
      // 토큰 갱신 관련 에러는 로그만 남기고 무시하지 않음 (사용자에게 알려야 함)
      if (
        errorMessage.includes("토큰 갱신") ||
        errorMessage.includes("Refresh Token")
      ) {
        // 토큰 갱신 에러는 무시하지 않고 로그만 남김
        console.warn("[AppProvider] Token refresh error:", errorMessage);
        return;
      }
      
      // 기타 중요한 에러는 그대로 표시
      console.error("[AppProvider] Unhandled promise rejection:", event.reason);
    };
    
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryProvider>
      <StoreProvider>{children}</StoreProvider>
    </QueryProvider>
  );
};

