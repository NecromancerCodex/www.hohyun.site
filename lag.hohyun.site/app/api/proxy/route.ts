import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API Route that acts as a proxy to the backend API server.
 *
 * This proxy:
 * - Runs on the server-side (Vercel serverless function)
 * - Forwards requests to the EC2 backend
 * - Handles CORS and authentication
 * - Allows using server-side environment variables (API_BASE_URL) without exposing them to the client
 */

// Server-side environment variable
// .env 파일 또는 Vercel 환경 변수에서 API_BASE_URL 필수
// 환경 변수가 없으면 에러 발생 (코드에 URL 하드코딩하지 않음)
const BACKEND_URL = process.env.API_BASE_URL;

if (!BACKEND_URL) {
  const errorMsg = 'API_BASE_URL environment variable is not set. ' +
    'Please set it in .env file (local) or Vercel environment variables (production).';
  console.error('[Proxy] ERROR:', errorMsg);
  throw new Error(errorMsg);
}

// 환경 변수 로드 확인
console.log('[Proxy] API_BASE_URL loaded from environment variables');

export async function POST(request: NextRequest) {
  try {
    // Get the path from query parameter (e.g., /api/proxy?path=rag)
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || 'rag';

    // Build the backend URL
    const backendUrl = `${BACKEND_URL}/${path}`;

    // Get request body
    const body = await request.json();

    console.log(`[Proxy] Forwarding POST request to: ${backendUrl}`);
    console.log(`[Proxy] Request body:`, JSON.stringify(body));

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[Proxy] Backend response status: ${response.status}`);

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error(`[Proxy] Non-JSON response: ${text}`);
      return NextResponse.json(
        {
          error: 'Backend returned non-JSON response',
          detail: text.substring(0, 200)
        },
        { status: response.status }
      );
    }

    // Return the response with proper status code
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[Proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[Proxy] Error stack:', errorStack);

    return NextResponse.json(
      {
        error: 'Proxy error',
        detail: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the path from query parameter
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || 'health';

    // Build the backend URL
    const backendUrl = `${BACKEND_URL}/${path}`;

    console.log(`[Proxy] Forwarding GET request to: ${backendUrl}`);

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Get response data
    const data = await response.json();

    // Return the response with proper status code
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('[Proxy] Error:', error);
    return NextResponse.json(
      {
        error: 'Proxy error',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

