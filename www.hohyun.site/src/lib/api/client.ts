// API Base URL - 환경 변수 또는 기본값
// Spring Gateway는 보통 /api 경로를 사용하므로 기본값에 포함
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// API Base URL 확인 로그 (개발 환경에서만)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(`[API Client] Base URL: ${API_BASE_URL}`);
  console.log(`[API Client] NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || "(not set, using default)"}`);
}

// Request Options 타입
interface RequestOptions extends RequestInit {
  timeout?: number;
}

// Fetch API를 사용한 HTTP 클라이언트
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // 기본 헤더 생성 (Access Token은 메모리에서 가져옴)
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Access Token은 Zustand store에서 가져옴
    if (typeof window !== "undefined") {
      try {
        // 동적 import를 피하기 위해 window 객체에 저장된 토큰 접근
        const store = (window as any).__loginStore;
        if (store) {
          const token = store.getState().accessToken;
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            if (process.env.NODE_ENV === "development") {
              console.log("[API Client] Authorization 헤더 추가됨 (토큰 길이:", token.length, ")");
            }
          } else {
            console.warn("[API Client] ⚠️ Access Token이 없습니다. 로그인 상태를 확인하세요.");
          }
        } else {
          console.warn("[API Client] ⚠️ Login Store가 초기화되지 않았습니다.");
        }
      } catch (error) {
        // store가 아직 초기화되지 않은 경우 무시
        console.warn("[API Client] ⚠️ Store 접근 중 에러:", error);
      }
    }

    return headers;
  }

  // 타임아웃 처리
  private async fetchWithTimeout(
    url: string,
    options: RequestOptions,
    timeout: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("요청 시간이 초과되었습니다.");
      }
      throw error;
    }
  }

  // 토큰 갱신 플래그 (무한 루프 방지)
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  // 에러 처리
  private async handleErrorResponse(response: Response, requestedUrl?: string, retry?: () => Promise<Response>): Promise<never> {
    // 401 Unauthorized - Access Token 만료, Refresh Token으로 재발급 시도
    if (response.status === 401 && retry && !requestedUrl?.includes("/auth/refresh")) {
      // 이미 갱신 중이면 해당 Promise 재사용 (동시 요청 방지)
      if (this.isRefreshing && this.refreshPromise) {
        try {
          console.log("[API Client] 토큰 갱신 중... 기존 갱신 Promise 재사용");
          const newToken = await this.refreshPromise;
          
          // 원래 요청 재시도
          const retriedResponse = await retry();
          if (retriedResponse.ok) {
            console.log("[API Client] 토큰 갱신 후 요청 성공");
            return retriedResponse as never;
          }
          
          // 재시도도 실패하면 에러
          console.error("[API Client] 토큰 갱신 후에도 요청 실패:", retriedResponse.status);
          throw new Error("토큰 갱신 후에도 요청이 실패했습니다.");
        } catch (error) {
          // 갱신 실패 시 로그아웃
          if (error instanceof Error && (
            error.message.includes("토큰 갱신 실패") ||
            error.message.includes("Refresh Token이 만료")
          )) {
            console.warn("[API Client] Refresh Token 만료로 인한 로그아웃");
            if (typeof window !== "undefined") {
              const store = (window as any).__loginStore;
              if (store) {
                store.getState().logout();
              }
            }
          }
          throw error;
        }
      }
      
      // 새로운 갱신 시작
      if (!this.isRefreshing) {
        console.log("[API Client] 새로운 토큰 갱신 시작");
        this.isRefreshing = true;
        
        this.refreshPromise = (async () => {
          try {
            const { refreshAccessToken } = await import("./auth");
            console.log("[API Client] Refresh Token으로 Access Token 갱신 요청");
            const newToken = await refreshAccessToken();
            
            if (!newToken || newToken.trim().length === 0) {
              throw new Error("갱신된 토큰이 비어있습니다.");
            }
            
            // 메모리에 새 토큰 저장
            if (typeof window !== "undefined") {
              const store = (window as any).__loginStore;
              if (store) {
                store.getState().setAccessToken(newToken);
                console.log("[API Client] 새 Access Token 저장 완료 (길이:", newToken.length, ")");
              } else {
                console.error("[API Client] ⚠️ Login Store를 찾을 수 없습니다.");
              }
            }
            
            return newToken;
          } catch (error) {
            console.error("[API Client] 토큰 갱신 실패:", error);
            
            // 갱신 실패 시 상태 정리
            this.isRefreshing = false;
            this.refreshPromise = null;
            
            // Refresh Token도 만료된 경우 로그아웃
            if (typeof window !== "undefined") {
              const store = (window as any).__loginStore;
              if (store) {
                console.warn("[API Client] Refresh Token 만료로 인한 로그아웃");
                store.getState().logout();
              }
            }
            
            const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
            throw new Error("토큰 갱신 실패: " + errorMessage);
          }
        })();
      }
      
      try {
        const newToken = await this.refreshPromise;
        
        // 갱신 성공 후 상태 정리 (다음 갱신을 위해)
        // 주의: isRefreshing은 refreshPromise 내부에서만 false로 설정
        // 여기서는 refreshPromise를 null로만 설정하여 다음 갱신을 허용
        
        // 원래 요청 재시도
        console.log("[API Client] 토큰 갱신 성공, 원래 요청 재시도");
        const retriedResponse = await retry();
        if (retriedResponse.ok) {
          console.log("[API Client] 토큰 갱신 후 요청 성공");
          // 성공 후에만 상태 정리
          this.isRefreshing = false;
          this.refreshPromise = null;
          return retriedResponse as never;
        }
        
        // 재시도도 실패하면 에러
        console.error("[API Client] 토큰 갱신 후에도 요청 실패:", retriedResponse.status);
        this.isRefreshing = false;
        this.refreshPromise = null;
        throw new Error("토큰 갱신 후에도 요청이 실패했습니다.");
      } catch (refreshError) {
        // 에러는 이미 refreshPromise 내부에서 처리됨
        // 하지만 여기서도 상태 정리
        this.isRefreshing = false;
        this.refreshPromise = null;
        throw refreshError;
      }
    }

    // 404 Not Found - 엔드포인트를 찾을 수 없음
    if (response.status === 404) {
      // 요청한 URL 정보를 에러에 포함
      const url = requestedUrl || response.url || "unknown";
      const enhancedError: any = new Error("요청한 엔드포인트를 찾을 수 없습니다. 백엔드 서버 설정을 확인해주세요.");
      enhancedError.response = {
        status: response.status,
        statusText: response.statusText,
        url: url,
        data: await response.json().catch(() => null),
      };
      enhancedError.userMessage = `404 에러: 요청한 API 엔드포인트를 찾을 수 없습니다.\n\n요청 URL: ${url}\n\n백엔드 서버(localhost:8080)가 실행 중이고, 해당 엔드포인트가 올바르게 설정되어 있는지 확인해주세요.`;
      // health check용 엔드포인트는 콘솔에 에러를 출력하지 않음
      if (url && !url.includes("/health") && !url.includes("/actuator")) {
        console.error("[API Client] 404 Error - Requested URL:", url);
      }
      throw enhancedError;
    }

    // 503 Service Unavailable - 백엔드 서버가 실행되지 않음
    if (response.status === 503) {
      const enhancedError: any = new Error("백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.");
      enhancedError.response = {
        status: response.status,
        statusText: response.statusText,
        data: await response.json().catch(() => null),
      };
      enhancedError.userMessage = enhancedError.message;
      throw enhancedError;
    }

    // 일반 에러
    const enhancedError: any = new Error(`HTTP ${response.status} ${response.statusText}`);
    enhancedError.response = {
      status: response.status,
      statusText: response.statusText,
      data: await response.json().catch(() => null),
    };
    throw enhancedError;
  }

  // GET 요청
  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ data: T }> {
    const makeRequest = async (): Promise<Response> => {
      const url = `${this.baseURL}${endpoint}`;
      return await this.fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: this.getHeaders(),
          credentials: "include", // Refresh Token 쿠키 포함
          ...options,
        },
        options.timeout || 10000
      );
    };

    try {
      const response = await makeRequest();

      if (!response.ok) {
        await this.handleErrorResponse(response, `${this.baseURL}${endpoint}`, makeRequest);
      }

      const contentType = response.headers.get("content-type");
      let data: T;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { data };
    } catch (error: any) {
      if (error.response) {
        throw error;
      }
      // 네트워크 에러
      const enhancedError: any = new Error("네트워크 연결을 확인해주세요. 백엔드 서버(localhost:8080)가 실행 중인지 확인해주세요.");
      enhancedError.userMessage = enhancedError.message;
      enhancedError.code = "ECONNREFUSED";
      throw enhancedError;
    }
  }

  // POST 요청
  async post<T = any>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<{ data: T }> {
    const makeRequest = async (): Promise<Response> => {
      const url = `${this.baseURL}${endpoint}`;
      console.log(`[API Client] POST Request: ${url}`, { body, baseURL: this.baseURL, endpoint });
      return await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.getHeaders(),
          credentials: "include", // Refresh Token 쿠키 포함
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        },
        options.timeout || 20000 // 기본 타임아웃 20초
      );
    };

    try {
      const response = await makeRequest();

      if (!response.ok) {
        await this.handleErrorResponse(response, `${this.baseURL}${endpoint}`, makeRequest);
      }

      // 응답이 비어있을 수 있음
      const contentType = response.headers.get("content-type");
      let data: T;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = (text || null) as unknown as T;
      }

      return { data };
    } catch (error: any) {
      console.error(`[API Client] POST Error: ${this.baseURL}${endpoint}`, error);
      
      // 이미 handleErrorResponse에서 처리된 에러 (서버 응답이 있음)
      if (error.response) {
        throw error;
      }
      
      // AbortError는 타임아웃
      if (error.name === "AbortError") {
        const timeoutError: any = new Error("요청 시간이 초과되었습니다.");
        timeoutError.userMessage = timeoutError.message;
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      
      // TypeError는 일반적으로 네트워크 연결 실패 또는 CORS 에러
      if (error instanceof TypeError) {
        // CORS 에러인지 확인
        if (error.message.includes("CORS") || error.message.includes("Failed to fetch")) {
          const corsError: any = new Error("CORS 오류가 발생했습니다. 백엔드 CORS 설정을 확인해주세요.");
          corsError.userMessage = corsError.message;
          corsError.code = "CORS_ERROR";
          throw corsError;
        }
        
        // 네트워크 연결 실패
        const networkError: any = new Error("네트워크 연결을 확인해주세요. 백엔드 서버(localhost:8080)가 실행 중인지 확인해주세요.");
        networkError.userMessage = networkError.message;
        networkError.code = "ECONNREFUSED";
        throw networkError;
      }
      
      // 기타 에러는 원본 메시지 사용
      const enhancedError: any = error;
      enhancedError.userMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      throw enhancedError;
    }
  }

  // PUT 요청
  async put<T = any>(
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<{ data: T }> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: this.getHeaders(),
          credentials: "include",
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        },
        options.timeout || 10000
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const contentType = response.headers.get("content-type");
      let data: T;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = (text || null) as unknown as T;
      }

      return { data };
    } catch (error: any) {
      if (error.response) {
        throw error;
      }
      const enhancedError: any = new Error("네트워크 연결을 확인해주세요. 백엔드 서버(localhost:8080)가 실행 중인지 확인해주세요.");
      enhancedError.userMessage = enhancedError.message;
      enhancedError.code = "ECONNREFUSED";
      throw enhancedError;
    }
  }

  // DELETE 요청
  async delete<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<{ data: T }> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "DELETE",
          headers: this.getHeaders(),
          credentials: "include",
          ...options,
        },
        options.timeout || 10000
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const contentType = response.headers.get("content-type");
      let data: T;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = (text || null) as unknown as T;
      }

      return { data };
    } catch (error: any) {
      if (error.response) {
        throw error;
      }
      const enhancedError: any = new Error("네트워크 연결을 확인해주세요. 백엔드 서버(localhost:8080)가 실행 중인지 확인해주세요.");
      enhancedError.userMessage = enhancedError.message;
      enhancedError.code = "ECONNREFUSED";
      throw enhancedError;
    }
  }
}

// API 클라이언트 인스턴스 생성
export const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;

