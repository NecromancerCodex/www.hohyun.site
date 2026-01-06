"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPublicDiariesByUserId, Diary } from "@/lib/api/diary";

// 인물 정보 타입
interface HistoricalFigure {
  id: string;
  name: string;
  description: string;
  titleKeyword?: string; // title에 포함될 키워드 (선택적)
  userId: number; // 모든 일기는 userId 1
  isDefault?: boolean; // 기본 인물 여부 (title 필터링 없이 userId만으로 조회)
}

// 인물 정보 매핑
// 모든 일기는 userId 1로 저장됩니다.
// - 이순신: 기존 일기는 날짜 형식이라 title 필터링 없이 userId 1의 모든 일기를 조회
// - 신규 인물: title에 인물 이름을 포함하도록 요구 (예: "넬슨 - 일기 제목")
const historicalFiguresMap: Record<string, HistoricalFigure> = {
  leesoonsin: {
    id: "leesoonsin",
    name: "이순신",
    description: "조선 중기의 무신이자 해군 제독",
    userId: 1,
    isDefault: true, // title 필터링 없이 userId 1의 모든 일기를 이순신 일기로 간주
  },
  // 넬슨 제독 추가 예시:
  // nelson: {
  //   id: "nelson",
  //   name: "넬슨 제독",
  //   description: "영국의 해군 제독",
  //   titleKeyword: "넬슨", // title에 "넬슨"이 포함된 일기만 조회
  //   userId: 1,
  //   isDefault: false,
  // },
};

interface DiaryWithEmotion extends Diary {
  emotionLoading?: boolean;
}

export default function CharacterHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const characterId = params?.character as string;

  const [figure, setFigure] = useState<HistoricalFigure | null>(null);
  const [diaries, setDiaries] = useState<DiaryWithEmotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!characterId) {
      setError("인물 정보가 없습니다.");
      setLoading(false);
      return;
    }

    // 인물 정보 조회
    const foundFigure = historicalFiguresMap[characterId];
    if (!foundFigure) {
      setError("인물을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    setFigure(foundFigure);

    // 일기 목록 조회
    const fetchDiaries = async () => {
      try {
        setLoading(true);
        setError(null);

        // userId 1의 모든 일기 조회 (모든 일기는 userId 1로 저장됨)
        const allDiaries = await getPublicDiariesByUserId(foundFigure.userId);
        
        // title에 인물 키워드가 포함된 일기만 필터링
        // isDefault가 true이면 필터링 없이 모든 일기 반환
        const filteredDiaries = foundFigure.isDefault
          ? allDiaries
          : allDiaries.filter((diary) => {
              const title = diary.title || "";
              const keyword = foundFigure.titleKeyword || "";
              return keyword ? title.includes(keyword) : true;
            });
        
        console.log(`[CharacterHistoryPage] ${foundFigure.name} 일기 목록 로드:`, filteredDiaries.length, `개 (전체: ${allDiaries.length}개)`);

        const diariesWithEmotion: DiaryWithEmotion[] = filteredDiaries.map((diary) => ({
          ...diary,
          emotionLoading: diary.emotion === null || diary.emotion === undefined,
        }));

        // 날짜 기준으로 정렬
        const sortedDiaries = [...diariesWithEmotion].sort((a, b) => {
          const dateA = new Date(a.diaryDate).getTime();
          const dateB = new Date(b.diaryDate).getTime();
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        setDiaries(sortedDiaries);
      } catch (err: any) {
        console.error("일기 목록 로드 실패:", err);
        setError(err.message || "일기 목록을 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchDiaries();
  }, [characterId, sortOrder]);

  // 날짜 포맷팅 함수
  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length >= 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2].split(" ")[0];
        const date = new Date(`${year}-${month}-${day}`);
        const dayOfWeek = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][
          date.getDay()
        ];
        return { year, month, day, dayOfWeek };
      }
      return { year: "", month: "", day: "", dayOfWeek: "" };
    } catch {
      return { year: "", month: "", day: "", dayOfWeek: "" };
    }
  };

  // 제목 정리
  const cleanTitle = (title: string) => {
    if (!title) return "";
    return title.replace(/<[^>]*>/g, "").trim() || "제목 없음";
  };

  // 감정 라벨 정규화
  const normalizeEmotionLabel = (label: string | undefined): string => {
    if (!label) return "";
    return label === "평가불가" ? "평범" : label;
  };

  // 감정 표시
  const getEmotionDisplay = (diary: DiaryWithEmotion): string => {
    if (diary.emotionProbabilities) {
      try {
        const probabilities = JSON.parse(diary.emotionProbabilities);
        const sorted = Object.entries(probabilities)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 2);

        if (sorted.length >= 2) {
          const first = normalizeEmotionLabel(sorted[0][0]);
          const second = normalizeEmotionLabel(sorted[1][0]);
          return `${first}/${second}`;
        } else if (sorted.length === 1) {
          return normalizeEmotionLabel(sorted[0][0]);
        }
      } catch (e) {
        // JSON 파싱 실패
      }
    }

    if (diary.emotionLabel) {
      return normalizeEmotionLabel(diary.emotionLabel);
    }

    return "";
  };

  // 감정 이모티콘
  const getEmotionEmoji = (diary: DiaryWithEmotion): string => {
    const emotionMap: Record<number, string> = {
      0: "😐",
      1: "😊",
      2: "😢",
      3: "😠",
      4: "😨",
      5: "🤢",
      6: "😲",
      7: "🤝",
      8: "✨",
      9: "😰",
      10: "😌",
      11: "😔",
      12: "💭",
      13: "🙏",
      14: "😞",
    };

    if (diary.emotionProbabilities) {
      try {
        const probabilities = JSON.parse(diary.emotionProbabilities);
        const sorted = Object.entries(probabilities)
          .sort(([, a], [, b]) => (b as number) - (a as number));

        if (sorted.length > 0) {
          const topEmotionLabel = normalizeEmotionLabel(sorted[0][0]);
          const labelToId: Record<string, number> = {
            '평가불가': 0, '평범': 0, '기쁨': 1, '슬픔': 2, '분노': 3,
            '두려움': 4, '혐오': 5, '놀람': 6, '신뢰': 7, '기대': 8,
            '불안': 9, '안도': 10, '후회': 11, '그리움': 12, '감사': 13, '외로움': 14,
          };
          const emotionId = labelToId[topEmotionLabel];
          if (emotionId !== undefined) {
            return emotionMap[emotionId] || "😐";
          }
        }
      } catch (e) {
        // JSON 파싱 실패
      }
    }

    if (diary.emotion !== null && diary.emotion !== undefined) {
      return emotionMap[diary.emotion] || "😐";
    }

    return "😐";
  };

  // 정렬 순서 토글
  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === "desc" ? "asc" : "desc";
    setSortOrder(newSortOrder);

    const sortedDiaries = [...diaries].sort((a, b) => {
      const dateA = new Date(a.diaryDate).getTime();
      const dateB = new Date(b.diaryDate).getTime();
      return newSortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
    setDiaries(sortedDiaries);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error || !figure) {
    return (
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">역사기록</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="text-center py-20">
            <div className="text-red-500">{error || "인물을 찾을 수 없습니다."}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{figure.name}</h1>
              <p className="text-sm text-gray-500">{figure.description}</p>
            </div>
          </div>
          {/* 정렬 버튼 */}
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
          >
            {sortOrder === "desc" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 13l5 5 5-5" />
                <path d="M7 6l5-5 5 5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 6l5 5 5-5" />
                <path d="M7 13l5 5 5-5" />
              </svg>
            )}
            <span>{sortOrder === "desc" ? "최신순" : "과거순"}</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {!loading && !error && diaries.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-500">일기가 없습니다.</div>
          </div>
        )}

        {!loading && !error && diaries.length > 0 && (
          <div className="bg-white">
            {diaries.map((diary) => {
              const { year, month, day, dayOfWeek } = formatDate(diary.diaryDate);
              const title = cleanTitle(diary.title);

              return (
                <div
                  key={diary.id}
                  className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors px-2 cursor-pointer"
                  onClick={() => {
                    router.push(`/history/${characterId}/${diary.id}`);
                  }}
                >
                  {/* Left: Title with Emotion */}
                  <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
                    <div className="text-sm text-gray-900 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">제목:</span>
                        <span className="font-medium truncate">{title}</span>
                      </div>
                      {!diary.emotionLoading && getEmotionDisplay(diary) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {getEmotionDisplay(diary)}
                        </div>
                      )}
                    </div>
                    {/* Emotion Emoji */}
                    <div className="text-lg flex-shrink-0">
                      {diary.emotionLoading ? (
                        <span className="text-gray-300 animate-pulse">⏳</span>
                      ) : (
                        <span>{getEmotionEmoji(diary)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Date Info */}
                  <div className="flex flex-col items-end gap-1 text-sm text-gray-600 whitespace-nowrap">
                    <div>{year}</div>
                    <div>{month}</div>
                    <div>{day}</div>
                    {dayOfWeek && <div className="text-gray-500">{dayOfWeek}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

