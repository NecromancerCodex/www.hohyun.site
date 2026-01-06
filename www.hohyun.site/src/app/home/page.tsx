"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChatInterface } from "@/components/organisms/ChatInterface";
import { Button } from "@/components/atoms/Button";
import { useLoginStore } from "@/store";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, restoreAuthState, debugAuthState } = useLoginStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 실행 (hydration 후)
    setIsHydrated(true);
    // 인증 상태 복원
    restoreAuthState();
    
    // 디버깅: 인증 상태 출력
    setTimeout(() => {
      console.log("[HomePage] 인증 상태 확인:");
      debugAuthState();
    }, 100);
  }, [restoreAuthState, debugAuthState]);

  useEffect(() => {
    // hydration이 완료된 후에만 체크
    if (!isHydrated) return;

    // 게스트 모드 체크
    const isGuest = typeof window !== "undefined" && sessionStorage.getItem("isGuest") === "true";
    
    // 게스트 모드면 인증 체크 건너뛰기
    if (isGuest) {
      return;
    }

    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    // accessToken은 페이지 로드 시 없을 수 있으므로 isAuthenticated만 체크
    // 실제 API 호출 시 client.ts에서 자동으로 refresh token을 사용해 access token 발급
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
  }, [isAuthenticated, router, isHydrated]);

  // hydration 완료 전까지는 로딩 상태 표시
  if (!isHydrated) {
    return null;
  }

  // 게스트 모드 체크
  const isGuest = typeof window !== "undefined" && sessionStorage.getItem("isGuest") === "true";
  
  // 로그인하지 않았고 게스트도 아닌 경우 아무것도 렌더링하지 않음 (리다이렉트 중)
  if (!isAuthenticated && !isGuest) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <ChatInterface />
    </div>
  );
}

