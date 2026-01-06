"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getDiaryById, Diary } from "@/lib/api/diary";

// 인물 정보 타입
interface HistoricalFigure {
  id: string;
  name: string;
  description: string;
  titleKeyword: string; // title에 포함될 키워드
  userId: number; // 모든 일기는 userId 1
}

// 인물 정보 매핑
// 모든 일기는 userId 1로 저장되며, title에 인물 이름이 포함되어 구분됩니다.
const historicalFiguresMap: Record<string, HistoricalFigure> = {
  leesoonsin: {
    id: "leesoonsin",
    name: "이순신",
    description: "조선 중기의 무신이자 해군 제독",
    titleKeyword: "이순신", // title에 "이순신"이 포함된 일기만 조회
    userId: 1,
  },
  // 넬슨 제독 추가 예시:
  // nelson: {
  //   id: "nelson",
  //   name: "넬슨 제독",
  //   description: "영국의 해군 제독",
  //   titleKeyword: "넬슨", // title에 "넬슨"이 포함된 일기만 조회
  //   userId: 1,
  // },
};

interface EmotionResponse {
  emotion: number;
  emotion_label: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export default function CharacterDiaryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const characterId = params?.character as string;
  const diaryId = params?.id ? Number(params.id) : null;

  const [figure, setFigure] = useState<HistoricalFigure | null>(null);
  const [diary, setDiary] = useState<Diary | null>(null);
  const [emotion, setEmotion] = useState<EmotionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllProbabilities, setShowAllProbabilities] = useState(false);
  const [showMbtiDetails, setShowMbtiDetails] = useState(false);

  useEffect(() => {
    if (!characterId || !diaryId) {
      setError("인물 정보 또는 일기 ID가 없습니다.");
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

    // 일기 조회 (인증 없이 공개 조회)
    const fetchDiary = async () => {
      try {
        setLoading(true);
        setError(null);

        // userId 없이 조회 (공개)
        const foundDiary = await getDiaryById(diaryId);

        if (!foundDiary) {
          setError("일기를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }

        setDiary(foundDiary);

        // DB에 감정 정보가 있으면 사용
        if (foundDiary.emotion !== null && foundDiary.emotion !== undefined) {
          if (foundDiary.emotionLabel) {
            let probabilities: Record<string, number> | undefined;
            if (foundDiary.emotionProbabilities) {
              try {
                probabilities = JSON.parse(foundDiary.emotionProbabilities);
              } catch (e) {
                console.warn(`[CharacterDiaryDetailPage] probabilities JSON 파싱 실패: ${e}`);
              }
            }
            setEmotion({
              emotion: foundDiary.emotion,
              emotion_label: foundDiary.emotionLabel,
              confidence: foundDiary.emotionConfidence,
              probabilities: probabilities,
            });
          }
        }
      } catch (err: any) {
        console.error("일기 로드 실패:", err);
        setError(err.message || "일기를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchDiary();
  }, [characterId, diaryId]);

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
  const getEmotionDisplay = (): string => {
    if (emotion?.probabilities) {
      const sorted = Object.entries(emotion.probabilities)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2);

      if (sorted.length >= 2) {
        const first = normalizeEmotionLabel(sorted[0][0]);
        const second = normalizeEmotionLabel(sorted[1][0]);
        return `${first}/${second}`;
      } else if (sorted.length === 1) {
        return normalizeEmotionLabel(sorted[0][0]);
      }
    }

    if (diary?.emotionLabel) {
      return normalizeEmotionLabel(diary.emotionLabel);
    }

    if (emotion?.emotion_label) {
      return normalizeEmotionLabel(emotion.emotion_label);
    }

    return "";
  };

  // 감정 이모티콘
  const getEmotionEmoji = (): string => {
    const emotionMap: Record<number, string> = {
      0: "😐", 1: "😊", 2: "😢", 3: "😠", 4: "😨", 5: "🤢", 6: "😲",
      7: "🤝", 8: "✨", 9: "😰", 10: "😌", 11: "😔", 12: "💭", 13: "🙏", 14: "😞",
    };

    const labelToId: Record<string, number> = {
      '평가불가': 0, '평범': 0, '기쁨': 1, '슬픔': 2, '분노': 3,
      '두려움': 4, '혐오': 5, '놀람': 6, '신뢰': 7, '기대': 8,
      '불안': 9, '안도': 10, '후회': 11, '그리움': 12, '감사': 13, '외로움': 14,
    };

    if (emotion?.probabilities && Object.keys(emotion.probabilities).length > 0) {
      const sorted = Object.entries(emotion.probabilities)
        .sort(([, a], [, b]) => b - a);

      if (sorted.length > 0) {
        const topEmotionLabel = normalizeEmotionLabel(sorted[0][0]);
        const emotionId = labelToId[topEmotionLabel];
        if (emotionId !== undefined) {
          return emotionMap[emotionId] || "😐";
        }
      }
    }

    if (diary?.emotion !== null && diary?.emotion !== undefined) {
      return emotionMap[diary.emotion] || "😐";
    }

    if (emotion) {
      return emotionMap[emotion.emotion] || "😐";
    }

    return "😐";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error || !diary || !figure) {
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
            <h1 className="text-xl font-semibold text-gray-900">역사기록 상세</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-6">
          <div className="text-center py-20">
            <div className="text-red-500">{error || "일기를 찾을 수 없습니다."}</div>
          </div>
        </main>
      </div>
    );
  }

  const { year, month, day, dayOfWeek } = formatDate(diary.diaryDate);
  const title = cleanTitle(diary.title);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
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
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{figure.name}의 기록</h1>
            <p className="text-sm text-gray-500">{figure.description}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <div className="text-2xl">
              {getEmotionEmoji()}
            </div>
          </div>

          {/* Date Info */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{year}년 {month}월 {day}일</span>
            {dayOfWeek && <span className="text-gray-500">{dayOfWeek}</span>}
            {getEmotionDisplay() && (
              <span className="ml-auto text-gray-500">
                감정: {getEmotionDisplay()}
              </span>
            )}
          </div>

          {/* MBTI Info */}
          {diary.mbtiType && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">MBTI 분석 결과</h3>
                {diary.mbtiDimensionPercentages && (
                  <button
                    onClick={() => setShowMbtiDetails(!showMbtiDetails)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {showMbtiDetails ? (
                      <>
                        <span>접기</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>4축 상세보기</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <span className="text-2xl font-bold text-purple-600">{diary.mbtiType}</span>
                </div>
                {diary.mbtiConfidence && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">
                        신뢰도: {(diary.mbtiConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-purple-500 transition-all"
                        style={{ width: `${diary.mbtiConfidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* MBTI 상세 정보 (기존 diaries/[id]/page.tsx와 동일한 구조) */}
              {showMbtiDetails && diary.mbtiDimensionPercentages && (
                <div className="mt-3 space-y-3">
                  {(['E_I', 'S_N', 'T_F', 'J_P'] as const).map((dimension) => {
                    const dimData = diary.mbtiDimensionPercentages?.[dimension];
                    if (!dimData) return null;

                    const dimensionLabels: Record<string, { full: string; left: string; right: string }> = {
                      E_I: { full: '에너지 방향', left: 'E (외향)', right: 'I (내향)' },
                      S_N: { full: '인식 기능', left: 'S (감각)', right: 'N (직관)' },
                      T_F: { full: '판단 기능', left: 'T (사고)', right: 'F (감정)' },
                      J_P: { full: '생활 양식', left: 'J (판단)', right: 'P (인식)' }
                    };

                    const labels = dimensionLabels[dimension];
                    const leftLetter = dimension.split('_')[0];
                    const rightLetter = dimension.split('_')[1];
                    const leftPercent = dimData.selected === leftLetter ? dimData.confidence_percent : 100 - dimData.confidence_percent;
                    const rightPercent = 100 - leftPercent;

                    return (
                      <div key={dimension} className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">{labels.full}</span>
                        </div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs ${dimData.selected === leftLetter ? 'font-bold text-purple-600' : 'text-gray-500'}`}>
                              {labels.left}
                            </span>
                            <span className={`text-xs ${dimData.selected === rightLetter ? 'font-bold text-purple-600' : 'text-gray-500'}`}>
                              {labels.right}
                            </span>
                          </div>
                          <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                              style={{ width: `${leftPercent}%` }}
                            />
                            <div
                              className="absolute right-0 h-full bg-gradient-to-l from-blue-500 to-blue-400 transition-all"
                              style={{ width: `${rightPercent}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-white drop-shadow-md">
                                {leftPercent.toFixed(0)}% : {rightPercent.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Emotion Probabilities */}
          {emotion?.probabilities && Object.keys(emotion.probabilities).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">감정 분석 확률</h3>
                {Object.keys(emotion.probabilities).length > 1 && (
                  <button
                    onClick={() => setShowAllProbabilities(!showAllProbabilities)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {showAllProbabilities ? (
                      <>
                        <span>접기</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>전체 보기</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {Object.entries(emotion.probabilities)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, showAllProbabilities ? undefined : 1)
                  .map(([label, prob]) => {
                    const normalizedLabel = normalizeEmotionLabel(label);
                    const percentage = (prob * 100).toFixed(1);
                    const isMain = normalizedLabel === normalizeEmotionLabel(Object.entries(emotion.probabilities!).sort(([, a], [, b]) => b - a)[0][0]);
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm ${isMain ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                              {normalizedLabel}
                            </span>
                            <span className={`text-sm ${isMain ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                              {percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isMain ? 'bg-blue-500' : 'bg-gray-400'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="prose max-w-none">
          <div className="text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
            {diary.content || "내용이 없습니다."}
          </div>
        </div>
      </main>
    </div>
  );
}

