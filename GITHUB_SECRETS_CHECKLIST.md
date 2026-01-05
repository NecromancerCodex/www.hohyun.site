# GitHub Secrets 체크리스트

현재 설정된 GitHub Secrets와 워크플로우에서 필요한 Secrets를 비교 분석한 결과입니다.

---

## ✅ API Gateway Secrets 상태

### 현재 설정된 Secrets ✅
- `DOCKERHUB_USERNAME` ✅
- `DOCKERHUB_TOKEN` ✅
- `EC2_HOST` ✅
- `EC2_USER` ✅
- `EC2_SSH_KEY` ✅
- `GOOGLE_CLIENT_ID` ✅
- `GOOGLE_CLIENT_SECRET` ✅
- `GOOGLE_REDIRECT_URI` ✅
- `JWT_SECRET` ✅
- `KAKAO_ADMIN_KEY` ✅ (워크플로우에서 사용하지 않음)
- `KAKAO_REDIRECT_URI` ✅
- `KAKAO_REST_API_KEY` ✅
- `NAVER_CLIENT_ID` ✅
- `NAVER_CLIENT_SECRET` ✅
- `NAVER_REDIRECT_URI` ✅
- `NEON_CONNECTION_STRING` ✅
- `NEON_DATABASE` ✅ (워크플로우에서 사용하지 않음)
- `NEON_HOST` ✅ (워크플로우에서 사용하지 않음)
- `NEON_PASSWORD` ✅
- `NEON_USER` ✅
- `UPSTASH_REDIS_HOST` ✅
- `UPSTASH_REDIS_PASSWORD` ✅
- `UPSTASH_REDIS_PORT` ✅
- `UPSTASH_REDIS_REST_TOKEN` ✅ (워크플로우에서 사용하지 않음)
- `UPSTASH_REDIS_REST_URL` ✅ (워크플로우에서 사용하지 않음)
- `UPSTASH_REDIS_URL` ✅ (워크플로우에서 사용하지 않음)
- `AI_SERVICE_RAG_URL` ✅
- `SPRING_JPA_HIBERNATE_DDL_AUTO` ✅ (워크플로우에서 사용하지 않음)
- `SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT` ✅ (워크플로우에서 사용하지 않음)
- `SPRING_JPA_PROPERTIES_HIBERNATE_FORMAT_SQL` ✅ (워크플로우에서 사용하지 않음)
- `SPRING_JPA_SHOW_SQL` ✅ (워크플로우에서 사용하지 않음)

### ⚠️ 누락된 Secrets (워크플로우에서 필요)
- `KAKAO_CLIENT_SECRET` ⚠️ **필수** (워크플로우에서 사용)
- `AI_SERVICE_VISION_URL` ⚠️ **선택사항** (워크플로우에서 사용, 비어있어도 Vision 서비스 미사용)

---

## ✅ Chat Service Secrets 상태

### 현재 설정된 Secrets ✅
- `DOCKERHUB_USERNAME` ✅
- `DOCKERHUB_TOKEN` ✅
- `EC2_HOST` ✅
- `EC2_USER` ✅
- `EC2_SSH_KEY` ✅
- `DATABASE_URL` ✅
- `OPENAI_API_KEY` ✅
- `LLM_PROVIDER` ✅ (워크플로우에서 사용하지 않음)
- `LOCAL_MODEL_DIR` ✅ (워크플로우에서 사용하지 않음, 하드코딩됨)
- `COLLECTION_NAME` ✅ (워크플로우에서 사용하지 않음)
- `PEFT_ADAPTER_PATH` ✅ (워크플로우에서 사용하지 않음)

### ⚠️ 누락된 Secrets (워크플로우에서 필요)
- `S3_MODEL_BUCKET` ⚠️ **필수** (S3 모델 사용 시)
- `S3_MODEL_PREFIX` ⚠️ **필수** (S3 모델 사용 시)
- `S3_MODEL_DIR_NAME` ⚠️ **필수** (S3 모델 사용 시)
- `AWS_REGION` ⚠️ **필수** (S3 모델 사용 시, 예: `ap-northeast-2`)
- `AWS_ACCESS_KEY_ID` ⚠️ **선택사항** (IAM 역할 사용 시 불필요)
- `AWS_SECRET_ACCESS_KEY` ⚠️ **선택사항** (IAM 역할 사용 시 불필요)
- `FRONTEND_URL` ⚠️ **선택사항** (CORS 설정용, 없어도 됨)

---

## 🔧 수정 사항

### 1. API Gateway - KAKAO_CLIENT_SECRET 추가 필요

**현재 상태**: `KAKAO_ADMIN_KEY`만 설정되어 있음  
**필요**: `KAKAO_CLIENT_SECRET` 추가 필요

**해결 방법**:
1. GitHub Secrets에 `KAKAO_CLIENT_SECRET` 추가
2. 또는 워크플로우에서 `KAKAO_ADMIN_KEY`를 `KAKAO_CLIENT_SECRET`으로 사용하도록 수정

### 2. API Gateway - AI_SERVICE_VISION_URL 추가 (선택사항)

**현재 상태**: `AI_SERVICE_VISION_URL`이 없음  
**필요**: Vision Service를 사용하지 않으면 빈 값 또는 설정하지 않아도 됨

**해결 방법**:
- Vision Service를 사용하지 않으면 그대로 두어도 됨
- Vision Service를 사용하려면 `http://vision.hohyun.site:8002` 추가

### 3. Chat Service - S3 관련 Secrets 추가 필요

**현재 상태**: S3 관련 Secrets가 없음  
**필요**: S3에서 모델을 로드하려면 필수

**해결 방법**:
1. S3 버킷 정보 설정:
   - `S3_MODEL_BUCKET`: S3 버킷 이름
   - `S3_MODEL_PREFIX`: 모델 경로 프리픽스 (예: `models/llama/`)
   - `S3_MODEL_DIR_NAME`: 모델 디렉토리 이름
   - `AWS_REGION`: AWS 리전 (예: `ap-northeast-2`)

2. IAM 역할 사용 시:
   - EC2 인스턴스에 IAM 역할 연결
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 불필요

3. IAM 역할 미사용 시:
   - `AWS_ACCESS_KEY_ID` 추가
   - `AWS_SECRET_ACCESS_KEY` 추가

---

## 📋 최종 체크리스트

### API Gateway
- [x] 기본 Secrets (Docker Hub, EC2) ✅
- [x] 데이터베이스 Secrets (Neon) ✅
- [x] Redis Secrets (Upstash) ✅
- [x] OAuth Secrets (Google, Naver, Kakao) ✅
- [x] JWT Secret ✅
- [x] AI Service URLs ✅
- [ ] `KAKAO_CLIENT_SECRET` 추가 필요 ⚠️
- [ ] `AI_SERVICE_VISION_URL` 추가 (선택사항) ⚠️

### Chat Service
- [x] 기본 Secrets (Docker Hub, EC2) ✅
- [x] 데이터베이스 Secret (DATABASE_URL) ✅
- [x] OpenAI API Key ✅
- [ ] S3 모델 Secrets 추가 필요 ⚠️
  - [ ] `S3_MODEL_BUCKET`
  - [ ] `S3_MODEL_PREFIX`
  - [ ] `S3_MODEL_DIR_NAME`
  - [ ] `AWS_REGION`
  - [ ] `AWS_ACCESS_KEY_ID` (IAM 역할 미사용 시)
  - [ ] `AWS_SECRET_ACCESS_KEY` (IAM 역할 미사용 시)

---

## 💡 권장 사항

1. **KAKAO_CLIENT_SECRET 추가**
   - Kakao Developers 콘솔에서 Client Secret 확인
   - GitHub Secrets에 `KAKAO_CLIENT_SECRET` 추가

2. **S3 모델 사용 결정**
   - S3에서 모델을 로드할 경우: 위의 S3 Secrets 추가
   - 로컬 모델 사용 시: 워크플로우 수정 필요 (현재는 S3 기반)

3. **IAM 역할 사용 권장**
   - EC2 인스턴스에 IAM 역할 연결
   - AWS 액세스 키 관리 불필요
   - 보안성 향상

---

## 🚀 다음 단계

1. ✅ `KAKAO_CLIENT_SECRET` GitHub Secret 추가
2. ✅ Chat Service에 S3 관련 Secrets 추가 (또는 IAM 역할 설정)
3. ✅ (선택) `AI_SERVICE_VISION_URL` 추가 (Vision Service 사용 시)
4. ✅ 배포 테스트

