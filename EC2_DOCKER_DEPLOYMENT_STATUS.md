# EC2 Docker 배포 준비 상태

## ✅ 배포 준비 완료 상태

모든 서비스가 EC2에 Docker 컨테이너로 배포할 준비가 완료되었습니다.

---

## 📦 서비스별 Dockerfile 상태

### 1. API Gateway (`api.hohyun.site/gateway/Dockerfile`)
- ✅ **상태**: 준비 완료
- **기술 스택**: Java 21, Spring Boot, Gradle
- **빌드 방식**: Multi-stage build (Gradle 빌드 → JRE 실행)
- **포트**: 8080
- **이미지 이름**: `{DOCKERHUB_USERNAME}/api-gateway:latest`
- **특징**:
  - Gradle 캐시 활용으로 빌드 최적화
  - Alpine JRE로 이미지 크기 최소화
  - 메모리 최적화 설정 (`-XX:MaxRAMPercentage=75.0`)

### 2. Chat Service (`chat.hohyun.site/Dockerfile`)
- ✅ **상태**: 준비 완료
- **기술 스택**: Python 3.11, FastAPI, Uvicorn
- **포트**: 8001
- **이미지 이름**: `{DOCKERHUB_USERNAME}/chat-service:latest`
- **특징**:
  - PostgreSQL 클라이언트 포함
  - PyTorch 및 transformers 라이브러리 지원
  - S3에서 모델 직접 로드 (볼륨 마운트 불필요)
  - Health check 엔드포인트: `/health`

### 3. Vision Service (`vision.hohyun.site/Dockerfile`)
- ✅ **상태**: 준비 완료
- **기술 스택**: Python 3.11, FastAPI, PyTorch (CUDA), Uvicorn
- **포트**: 8002
- **이미지 이름**: `{DOCKERHUB_USERNAME}/vision-service:latest`
- **특징**:
  - GPU 지원 (CUDA 12.1, PyTorch 2.5.1)
  - YOLO + Diffusers 통합 서비스
  - xFormers로 메모리 최적화
  - S3에서 모델 직접 로드 (볼륨 마운트 불필요)
  - Health check 엔드포인트: `/health`

---

## 🚀 GitHub Actions 워크플로우 상태

### 1. API Gateway 배포 (`deploy-api-gateway.yml`)
- ✅ **상태**: 준비 완료
- **트리거**: `main` 브랜치 push (api.hohyun.site 변경 시)
- **단계**:
  1. Docker 이미지 빌드 및 Docker Hub 푸시
  2. EC2 SSH 접속 및 컨테이너 배포
  3. Health check (`/actuator/health`)

### 2. Chat Service 배포 (`deploy-chat-service.yml`)
- ✅ **상태**: 준비 완료
- **트리거**: `main` 브랜치 push (chat.hohyun.site 변경 시)
- **단계**:
  1. Docker 이미지 빌드 및 Docker Hub 푸시
  2. EC2 SSH 접속 및 컨테이너 배포
  3. Health check (`/health`)

### 3. Vision Service 배포 (`deploy-vision-service.yml`)
- ⚠️ **상태**: 준비 완료 (수동 실행만 가능)
- **트리거**: `workflow_dispatch` (수동 실행)
- **단계**:
  1. Docker 이미지 빌드 및 Docker Hub 푸시
  2. EC2 SSH 접속 및 컨테이너 배포 (GPU 지원)
  3. Health check (`/health`)
- **비고**: 자동 배포 비활성화 (api, chat 먼저 배포 후 활성화 예정)

---

## 📝 필요한 GitHub Secrets

각 서비스별로 필요한 GitHub Secrets 목록:

### 공통 Secrets (모든 서비스)
- `DOCKERHUB_USERNAME`: Docker Hub 사용자명
- `DOCKERHUB_TOKEN`: Docker Hub 액세스 토큰
- `EC2_HOST`: EC2 인스턴스 IP 주소 또는 도메인
- `EC2_USER`: EC2 SSH 사용자명 (보통 `ubuntu` 또는 `ec2-user`)
- `EC2_SSH_KEY`: EC2 SSH 개인 키

### API Gateway 전용 Secrets
- `NEON_CONNECTION_STRING`: Neon PostgreSQL 연결 문자열
- `NEON_USER`: Neon PostgreSQL 사용자명
- `NEON_PASSWORD`: Neon PostgreSQL 비밀번호
- `UPSTASH_REDIS_HOST`: Upstash Redis 호스트
- `UPSTASH_REDIS_PORT`: Upstash Redis 포트
- `UPSTASH_REDIS_PASSWORD`: Upstash Redis 비밀번호
- `JWT_SECRET`: JWT 서명 비밀키
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Google OAuth
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`: Naver OAuth
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`: Kakao OAuth
- `AI_SERVICE_RAG_URL`: Chat Service URL (예: `http://chat.hohyun.site:8001`)
- `AI_SERVICE_VISION_URL`: Vision Service URL (예: `http://vision.hohyun.site:8002`, 선택사항)

### Chat Service 전용 Secrets
- `DATABASE_URL`: PostgreSQL 연결 문자열 (Neon)
- `OPENAI_API_KEY`: OpenAI API 키
- `S3_MODEL_BUCKET`: S3 모델 버킷 이름
- `S3_MODEL_PREFIX`: S3 모델 경로 프리픽스 (예: `models/llama/`)
- `AWS_REGION`: AWS 리전 (예: `ap-northeast-2`)
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키 (IAM 역할 사용 시 불필요)
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키 (IAM 역할 사용 시 불필요)
- `FRONTEND_URL`: 프론트엔드 URL (CORS 설정용, 선택사항)

### Vision Service 전용 Secrets
- `S3_MODEL_BUCKET`: S3 모델 버킷 이름
- `S3_VISION_MODEL_PREFIX`: Vision 모델 경로 프리픽스
- `S3_VISION_MODEL_DIR_NAME`: Diffusers 모델 디렉토리 이름 (예: `sdxl_base`)
- `AWS_REGION`: AWS 리전
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키 (IAM 역할 사용 시 불필요)
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키 (IAM 역할 사용 시 불필요)
- `FRONTEND_URL`: 프론트엔드 URL (CORS 설정용, 선택사항)
- Vision 환경 변수 (선택사항, 기본값 있음):
  - `VISION_DEVICE`: `cuda` (기본값)
  - `VISION_DTYPE`: `float16` (기본값)
  - `VISION_DEFAULT_WIDTH`, `VISION_DEFAULT_HEIGHT`: `1024` (기본값)
  - 등등...

---

## 🗂️ .dockerignore 상태

### Chat Service (`.dockerignore`)
- ✅ 모델 디렉토리 제외: `llama/app/model/`
- ✅ Git, IDE 파일 제외
- ✅ Python 캐시 제외

### Vision Service (`.dockerignore`)
- ✅ 모델 디렉토리 제외: `diffusers/app/model/`, `yolo/app/data/`
- ✅ Git, IDE 파일 제외
- ✅ Python 캐시 제외
- ✅ 출력 디렉토리 제외: `diffusers/app/outputs/`, `yolo/app/save/`

---

## 🔍 Health Check 엔드포인트

모든 서비스에 health check 엔드포인트가 구현되어 있습니다:

- **API Gateway**: `http://{host}:8080/actuator/health`
- **Chat Service**: `http://{host}:8001/health`
- **Vision Service**: `http://{host}:8002/health`

---

## 📋 배포 체크리스트

배포 전 확인 사항:

### 사전 준비
- [ ] Docker Hub 계정 생성 및 액세스 토큰 발급
- [ ] EC2 인스턴스 3개 생성 (또는 1개 인스턴스에 모든 서비스 배포)
- [ ] EC2 인스턴스에 Docker 설치 확인
- [ ] EC2 Security Group에 필요한 포트 열기:
  - 8080 (API Gateway)
  - 8001 (Chat Service)
  - 8002 (Vision Service)
- [ ] EC2 인스턴스에 IAM 역할 연결 (S3 접근용, 선택사항)
- [ ] GitHub Secrets 설정 완료

### 배포 순서 (권장)
1. **Chat Service 배포** (8001 포트)
   - 가장 기본적인 서비스
   - API Gateway가 의존함
2. **API Gateway 배포** (8080 포트)
   - Chat Service에 연결
   - Vision Service는 선택사항이므로 나중에 연결 가능
3. **Vision Service 배포** (8002 포트)
   - GPU 인스턴스 필요
   - 필요시에만 배포

---

## 🐛 문제 해결

### Docker 이미지 빌드 실패
- GitHub Actions 로그 확인
- Dockerfile 경로 확인
- Docker Hub 로그인 확인

### 컨테이너 시작 실패
- EC2에서 `docker logs {container-name}` 확인
- 환경 변수 확인 (`~/.env.{service-name}`)
- 포트 충돌 확인 (`sudo ss -tulpn | grep :{port}`)

### Health Check 실패
- 컨테이너 로그 확인
- 네트워크 연결 확인
- 서비스가 실제로 시작되었는지 확인

### S3 모델 로드 실패
- IAM 역할 확인 (EC2 인스턴스에 연결)
- 또는 AWS 액세스 키 확인
- S3 버킷 이름 및 경로 확인
- S3 버킷 정책 확인

---

## 📊 아키텍처 요약

```
┌─────────────────────────────────────────────────┐
│            EC2 인스턴스 (또는 3개)                │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ API Gateway  │  │ Chat Service │            │
│  │   :8080      │──│   :8001      │            │
│  └──────────────┘  └──────────────┘            │
│         │                  │                    │
│         │                  │                    │
│         │         ┌──────────────┐              │
│         └─────────│Vision Service│              │
│                   │   :8002      │              │
│                   │   (GPU)      │              │
│                   └──────────────┘              │
│                          │                      │
└──────────────────────────┼──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                ┌───▼───┐    ┌───▼───┐
                │  S3   │    │Neon DB│
                │Models │    │       │
                └───────┘    └───────┘
```

---

## ✅ 최종 확인

모든 준비가 완료되었습니다! 다음 단계:

1. GitHub Secrets 설정 확인
2. EC2 인스턴스 준비 확인
3. 첫 번째 서비스 (Chat Service) 배포 테스트
4. API Gateway 배포 및 연결 테스트
5. (선택) Vision Service 배포

축하합니다! 🎉

