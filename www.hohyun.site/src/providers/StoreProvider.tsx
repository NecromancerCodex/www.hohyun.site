"use client";

import React, { ReactNode, useEffect } from "react";
import { useLoginStore } from "@/store/slices/loginSlice";
import { useSearchStore } from "@/store/slices/searchSlice";

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * Store Provider - Zustand stores를 초기화하고 제공
 * Zustand는 전역 상태이므로 Context로 감쌀 필요는 없지만,
 * 의존성 주입 패턴을 유지하기 위해 Provider로 감싸줍니다.
 * 실제로는 Zustand hooks를 직접 사용하면 됩니다.
 */
export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  // Zustand stores 초기화
  useLoginStore.getState();
  useSearchStore.getState();

  // API Client가 접근할 수 있도록 window 객체에 loginStore 노출
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__loginStore = useLoginStore;
    }
  }, []);

  return <>{children}</>;
};

