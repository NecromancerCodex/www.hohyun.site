import apiClient from "./client";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success?: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  message?: string;
}

export interface SocialLoginRequest {
  code?: string;
  accessToken?: string;
}

// 일반 로그인 (현재 백엔드에 구현되지 않음 - OAuth만 지원)
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  // TODO: 일반 로그인 엔드포인트 구현 필요
  throw new Error("일반 로그인은 현재 지원되지 않습니다. OAuth 로그인을 사용해주세요.");
};

// 소셜 로그인 함수들은 각 OAuth 제공자별 파일에서 export됨:
// - kakaoLogin: ./kakao.ts
// - naverLogin: ./naver.ts
// - googleLogin: ./google.ts

// 로그아웃 - Refresh Token 쿠키는 백엔드가 제거
export const logout = async (): Promise<void> => {
  await apiClient.post("/api/auth/logout");
  // Access Token은 메모리(Zustand store)에서 관리되므로 여기서는 제거하지 않음
};

// Access Token 갱신 (Refresh Token은 HttpOnly 쿠키로 자동 전송)
export const refreshAccessToken = async (): Promise<string> => {
  try {
    console.log("[Auth] Access Token 갱신 요청 시작");
    const { data } = await apiClient.post<{ access_token: string }>("/api/auth/refresh");
    
    if (!data) {
      console.error("[Auth] 토큰 갱신 응답이 비어있습니다.");
      throw new Error("토큰 갱신 응답이 비어있습니다.");
    }
    
    if (!data.access_token) {
      console.error("[Auth] 토큰 갱신 응답에 access_token이 없습니다:", data);
      throw new Error("토큰 갱신 응답에 access_token이 없습니다.");
    }
    
    if (data.access_token.trim().length === 0) {
      console.error("[Auth] 토큰 갱신 응답의 access_token이 비어있습니다.");
      throw new Error("토큰 갱신 응답의 access_token이 비어있습니다.");
    }
    
    console.log("[Auth] Access Token 갱신 성공 (길이:", data.access_token.length, ")");
    return data.access_token;
  } catch (error: any) {
    console.error("[Auth] Access Token 갱신 실패:", error);
    
    // 네트워크 에러나 401 에러는 Refresh Token 만료를 의미
    if (error.response?.status === 401 || error.code === "ECONNREFUSED") {
      const errorMsg = "Refresh Token이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.";
      console.warn("[Auth]", errorMsg);
      throw new Error(errorMsg);
    }
    
    // 기타 에러는 그대로 전달
    const errorMessage = error.message || "토큰 갱신 중 알 수 없는 오류가 발생했습니다.";
    throw new Error(errorMessage);
  }
};

// JWT 토큰에서 사용자 ID 추출 (메모리에서 토큰 가져와야 함)
export const getUserIdFromToken = (token?: string): string | null => {
  if (!token) return null;
  
  try {
    
    // JWT 토큰은 .으로 구분된 3부분으로 구성: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    // payload 디코딩
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // 사용자 ID 추출 (sub, userId, id 등 다양한 필드명 지원)
    return payload.sub || payload.userId || payload.id || payload.username || null;
  } catch (error) {
    console.error("[Auth] JWT 토큰 디코딩 실패:", error);
    return null;
  }
};

