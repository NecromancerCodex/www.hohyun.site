# GitHub Secrets 추가 필요 사항

현재 설정된 GitHub Secrets를 워크플로우와 비교한 결과, 다음 Secrets를 추가해야 합니다.

---

## ⚠️ API Gateway - 필수 Secrets 추가 필요

### 1. `KAKAO_CLIENT_SECRET` 추가 필요

**현재 상태**: 
- ❌ `KAKAO_CLIENT_SECRET` 없음
- ✅ `KAKAO_ADMIN_KEY` 있음 (다른 용도)

**문제**: 
- 워크플로우 (`deploy-api-gateway.yml`)에서 `KAKAO_CLIENT_SECRET` 사용
- `application.yaml`에서 `kakao.client-secret`으로 사용

**해결 방법**:
1. Kakao Developers 콘솔에서 Client Secret 확인
   - https://developers.kakao.com/ 접속
   - 내 애플리케이션 → 앱 키 → Client Secret 확인
2. GitHub Secrets에 추가:
   - Repository → Settings → Secrets and variables → Actions
   - New repository secret
   - Name: `KAKAO_CLIENT_SECRET`
   - Value: (Kakao Developers에서 확인한 Client Secret)

**참고**:
- `KAKAO_ADMIN_KEY`: REST API 호출용 (Admin Key)
- `KAKAO_CLIENT_SECRET`: OAuth 인증용 (Client Secret)
- 둘은 다른 값입니다.

### 2. `AI_SERVICE_VISION_URL` 추가 (선택사항)

**현재 상태**: 없음

**문제**: 없음 (선택사항)

**해결 방법**:
- Vision Service를 사용하지 않으면: 추가하지 않아도 됨 (비어있으면 미사용)
- Vision Service를 사용하려면: `http://vision.hohyun.site:8002` 추가

---

## ⚠️ Chat Service - 필수 Secrets 추가 필요

### S3 모델 관련 Secrets 추가 필요

**현재 상태**: S3 관련 Secrets가 없음

**문제**: 
- 워크플로우 (`deploy-chat-service.yml`)에서 다음 Secrets 사용:
  - `S3_MODEL_BUCKET`
  - `S3_MODEL_PREFIX`
  - `S3_MODEL_DIR_NAME`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID` (IAM 역할 미사용 시)
  - `AWS_SECRET_ACCESS_KEY` (IAM 역할 미사용 시)

**해결 방법 1: IAM 역할 사용 (권장)**

1. EC2 인스턴스에 IAM 역할 연결:
   - EC2 인스턴스 선택 → Actions → Security → Modify IAM role
   - S3 읽기 권한이 있는 IAM 역할 선택 또는 생성

2. GitHub Secrets 추가 (AWS 키 불필요):
   ```
   S3_MODEL_BUCKET: (S3 버킷 이름, 예: my-models-bucket)
   S3_MODEL_PREFIX: (모델 경로 프리픽스, 예: models/llama/)
   S3_MODEL_DIR_NAME: (모델 디렉토리 이름)
   AWS_REGION: (AWS 리전, 예: ap-northeast-2)
   ```

**해결 방법 2: AWS 액세스 키 사용**

1. IAM에서 액세스 키 생성:
   - IAM → Users → 해당 사용자 → Security credentials
   - Create access key
   - Access key ID와 Secret access key 저장

2. GitHub Secrets 추가:
   ```
   S3_MODEL_BUCKET: (S3 버킷 이름)
   S3_MODEL_PREFIX: (모델 경로 프리픽스)
   S3_MODEL_DIR_NAME: (모델 디렉토리 이름)
   AWS_REGION: (AWS 리전, 예: ap-northeast-2)
   AWS_ACCESS_KEY_ID: (IAM 액세스 키 ID)
   AWS_SECRET_ACCESS_KEY: (IAM 시크릿 액세스 키)
   ```

---

## 📋 추가해야 할 Secrets 요약

### API Gateway
- [ ] `KAKAO_CLIENT_SECRET` ⚠️ **필수**
- [ ] `AI_SERVICE_VISION_URL` (선택사항, Vision Service 사용 시)

### Chat Service
- [ ] `S3_MODEL_BUCKET` ⚠️ **필수**
- [ ] `S3_MODEL_PREFIX` ⚠️ **필수**
- [ ] `S3_MODEL_DIR_NAME` ⚠️ **필수**
- [ ] `AWS_REGION` ⚠️ **필수**
- [ ] `AWS_ACCESS_KEY_ID` (IAM 역할 미사용 시)
- [ ] `AWS_SECRET_ACCESS_KEY` (IAM 역할 미사용 시)
- [ ] `FRONTEND_URL` (선택사항, CORS 설정용)

---

## ✅ 이미 설정된 Secrets (참고용)

### API Gateway ✅
- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
- `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
- `NEON_CONNECTION_STRING`, `NEON_USER`, `NEON_PASSWORD`
- `UPSTASH_REDIS_HOST`, `UPSTASH_REDIS_PORT`, `UPSTASH_REDIS_PASSWORD`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`
- `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URI`
- `AI_SERVICE_RAG_URL`

### Chat Service ✅
- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
- `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`

---

## 🚀 다음 단계

1. **KAKAO_CLIENT_SECRET 추가** (API Gateway)
   - Kakao Developers 콘솔에서 확인
   - GitHub Secrets에 추가

2. **S3 관련 Secrets 추가** (Chat Service)
   - S3 버킷 정보 확인
   - IAM 역할 설정 또는 AWS 액세스 키 생성
   - GitHub Secrets에 추가

3. **(선택) AI_SERVICE_VISION_URL 추가** (API Gateway)
   - Vision Service 사용 시에만 추가

4. **배포 테스트**
   - GitHub Actions 워크플로우 실행
   - 배포 상태 확인

---

## 💡 참고 사항

### KAKAO_ADMIN_KEY vs KAKAO_CLIENT_SECRET
- **KAKAO_ADMIN_KEY**: REST API 호출용 (Admin Key)
  - 예: 카카오톡 메시지 전송, 푸시 알림 등
- **KAKAO_CLIENT_SECRET**: OAuth 인증용 (Client Secret)
  - 예: 카카오 로그인 인증 토큰 발급

둘은 다른 값이며, OAuth 인증에는 `KAKAO_CLIENT_SECRET`이 필요합니다.

### IAM 역할 vs AWS 액세스 키
- **IAM 역할 (권장)**:
  - EC2 인스턴스에 연결
  - AWS 액세스 키 관리 불필요
  - 보안성 향상
  - 자동 권한 관리

- **AWS 액세스 키**:
  - GitHub Secrets에 저장
  - 수동 관리 필요
  - 키 로테이션 필요
  - 보안 위험 상대적으로 높음

