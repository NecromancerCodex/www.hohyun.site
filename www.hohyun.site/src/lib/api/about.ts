/**
 * 자기소개글 API 함수들
 * 백엔드 게이트웨이 서버와 연동
 */

import apiClient from "./client";

export interface About {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 백엔드 Messenger 응답 형식
export interface MessengerResponse {
  code: number;
  message: string;
  data?: About;
}

/**
 * 자기소개글 조회 (JWT 토큰 기반)
 */
export async function getAbout(): Promise<About | null> {
  try {
    const response = await apiClient.get<MessengerResponse>("/api/about/user");
    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }
    // 404는 자기소개글이 없는 경우이므로 null 반환
    if (response.data.code === 404) {
      return null;
    }
    throw new Error(response.data.message || "자기소개글을 가져올 수 없습니다.");
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // 자기소개글이 없는 경우
    }
    console.error("[About API] 자기소개글 조회 실패:", error);
    throw error;
  }
}

/**
 * 자기소개글 저장
 */
export async function saveAbout(content: string): Promise<About> {
  try {
    const response = await apiClient.post<MessengerResponse>("/api/about", {
      content: content,
    });
    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || "자기소개글 저장에 실패했습니다.");
  } catch (error: any) {
    console.error("[About API] 자기소개글 저장 실패:", error);
    throw error;
  }
}

/**
 * 자기소개글 수정
 */
export async function updateAbout(content: string): Promise<About> {
  try {
    const response = await apiClient.put<MessengerResponse>("/api/about", {
      content: content,
    });
    if (response.data.code === 200 && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || "자기소개글 수정에 실패했습니다.");
  } catch (error: any) {
    console.error("[About API] 자기소개글 수정 실패:", error);
    throw error;
  }
}

/**
 * 자기소개글 삭제
 */
export async function deleteAbout(): Promise<void> {
  try {
    const response = await apiClient.delete<MessengerResponse>("/api/about");
    if (response.data.code !== 200) {
      throw new Error(response.data.message || "자기소개글 삭제에 실패했습니다.");
    }
  } catch (error: any) {
    console.error("[About API] 자기소개글 삭제 실패:", error);
    throw error;
  }
}

