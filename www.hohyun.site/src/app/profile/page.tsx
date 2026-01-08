"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { getUserIdFromToken } from "@/lib/api/auth";
import { getUserById, updateUser, User } from "@/lib/api/user";
import { ChatInterface } from "@/components/organisms/ChatInterface";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useLoginStore();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userId = getUserIdFromToken(accessToken || undefined);

  // 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      if (!isAuthenticated || !accessToken || !userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getUserById(Number(userId), accessToken);
        if (response.code === 200 && response.data) {
          setUser(response.data);
          setNickname(response.data.nickname || "");
        } else {
          setError(response.message || "사용자 정보를 불러올 수 없습니다.");
        }
      } catch (err: any) {
        console.error("사용자 정보 로드 오류:", err);
        setError(err.response?.data?.message || err.message || "사용자 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [isAuthenticated, accessToken, userId]);

  // 닉네임 저장
  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setError("닉네임은 2~20자 사이여야 합니다.");
      return;
    }

    if (!isAuthenticated || !accessToken || !userId || !user) {
      setError("로그인이 필요합니다.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await updateUser(
        {
          ...user,
          nickname: nickname.trim(),
        },
        accessToken
      );

      if (response.code === 200 && response.data) {
        setUser(response.data);
        setSuccess("닉네임이 변경되었습니다.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.message || "닉네임 변경에 실패했습니다.");
      }
    } catch (err: any) {
      console.error("닉네임 저장 오류:", err);
      setError(err.response?.data?.message || err.message || "닉네임 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 게스트 모드 체크
  if (!isAuthenticated || !userId) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="w-64 flex-shrink-0">
          <ChatInterface />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-600 text-lg mb-4">로그인이 필요합니다.</div>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              로그인하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar - ChatInterface 컴포넌트 재사용 */}
      <div className="w-64 flex-shrink-0">
        <ChatInterface />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
        <div className="max-w-2xl mx-auto p-8 space-y-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            프로필
          </h1>

          {/* 닉네임 변경 카드 */}
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">닉네임 변경</h2>
            
            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                닉네임
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 20) {
                    setNickname(value);
                    setError(null);
                  }
                }}
                placeholder="닉네임을 입력하세요 (2~20자)"
                disabled={isLoading || isSaving}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:bg-gray-100"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {nickname.length}/20자
                </span>
                {error && (
                  <span className="text-xs text-red-600">{error}</span>
                )}
                {success && (
                  <span className="text-xs text-green-600">{success}</span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveNickname}
                disabled={isLoading || isSaving || nickname.trim().length < 2}
                className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {/* 계정 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">계정 정보</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                {isLoading ? (
                  <div className="text-gray-400 text-sm">로딩 중...</div>
                ) : (
                  <div className="text-gray-800 text-base">
                    {user?.email || "이메일 정보가 없습니다."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

