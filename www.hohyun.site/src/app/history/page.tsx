"use client";

import React from "react";
import { useRouter } from "next/navigation";

// 인물 정보 타입
interface HistoricalFigure {
  id: string;
  name: string;
  description: string;
  titleKeyword: string; // title에 포함될 키워드 (예: "이순신", "넬슨")
  userId: number; // 모든 일기는 userId 1로 저장 (CRUD는 userId 1만 가능)
  image?: string;
}

// 인물 목록 (차후 확장 가능)
// 모든 일기는 userId 1로 저장되며, title에 인물 이름이 포함되어 구분됩니다.
// 예: "이순신 - 일기 제목" 또는 "[이순신] 일기 제목"
const historicalFigures: HistoricalFigure[] = [
  {
    id: "leesoonsin",
    name: "이순신",
    description: "조선 중기의 무신이자 해군 제독",
    titleKeyword: "이순신", // title에 "이순신"이 포함된 일기만 조회
    userId: 1, // 모든 일기는 userId 1
  },
  // 넬슨 제독 추가 예시:
  // {
  //   id: "nelson",
  //   name: "넬슨 제독",
  //   description: "영국의 해군 제독",
  //   titleKeyword: "넬슨", // title에 "넬슨"이 포함된 일기만 조회
  //   userId: 1, // 모든 일기는 userId 1
  // },
];

export default function HistoryPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="뒤로가기"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            역사기록
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="text-gray-600 text-lg">
            역사 속 인물들의 기록을 탐색해보세요.
          </p>
        </div>

        {/* 인물 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {historicalFigures.map((figure) => (
            <div
              key={figure.id}
              onClick={() => router.push(`/history/${figure.id}`)}
              className="group relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-200 hover:border-purple-300"
            >
              {/* 카드 배경 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* 카드 내용 */}
              <div className="relative p-6">
                {/* 인물 아이콘/이미지 영역 */}
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <span className="text-3xl font-bold text-white">
                    {figure.name.charAt(0)}
                  </span>
                </div>

                {/* 인물 이름 */}
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                  {figure.name}
                </h2>

                {/* 인물 설명 */}
                <p className="text-sm text-gray-600 text-center mb-4">
                  {figure.description}
                </p>

                {/* 일기 보기 버튼 */}
                <div className="flex items-center justify-center gap-2 text-purple-600 font-medium group-hover:text-purple-700">
                  <span>일기 보기</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:translate-x-1 transition-transform"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 인물이 없을 때 */}
        {historicalFigures.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">등록된 인물이 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}

