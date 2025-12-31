"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    // 백엔드 Swagger 문서로 리다이렉트
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api.hohyun.site:8000';
    const docsUrl = `${backendUrl}/docs`;

    // 새 창에서 열기
    window.open(docsUrl, '_blank');

    // 또는 현재 창에서 리다이렉트하려면:
    // window.location.href = docsUrl;
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">API 문서로 이동 중...</h1>
        <p className="text-gray-400 mb-4">
          백엔드 Swagger 문서가 새 창에서 열립니다.
        </p>
        <p className="text-sm text-gray-500">
          열리지 않으면{" "}
          <a
            href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api.hohyun.site:8000'}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            여기를 클릭하세요
          </a>
        </p>
      </div>
    </div>
  );
}

