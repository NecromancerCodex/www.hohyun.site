# 로컬 서버 실행 가이드

컨테이너 없이 로컬에서 각 서비스를 직접 실행하여 매핑이 제대로 작동하는지 확인할 수 있습니다.

## 📋 실행 순서

### 1단계: Chat Service 실행 (포트 8001)

**터미널 1**:
```bash
cd chat.hohyun.site

# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
export DATABASE_URL="your-neon-connection-string"  # 또는 .env 파일 사용
export OPENAI_API_KEY="your-openai-key"  # OpenAI 사용 시
export LOCAL_MODEL_DIR="./llama/app/model/llama_ko"  # 로컬 모델 경로
# S3 사용 안 함: S3_MODEL_BUCKET 설정하지 않음

# 서버 실행
python main.py
# 또는
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

**확인**:
- 서버 시작 메시지 확인
- `http://localhost:8001/health` 접속하여 상태 확인
- `http://localhost:8001/docs` 접속하여 Swagger UI 확인

---

### 2단계: Vision Service 실행 (포트 8002)

**터미널 2**:
```bash
cd vision.hohyun.site

# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# PyTorch 설치 (CUDA 지원, GPU 사용 시)
pip install torch==2.5.1+cu121 torchvision==0.20.1+cu121 torchaudio==2.5.1+cu121 \
  --index-url https://download.pytorch.org/whl/cu121
pip install xformers

# 환경 변수 설정
export DEVICE=cuda  # 또는 cpu
export DTYPE=float16
# S3 사용 안 함: S3_MODEL_BUCKET 설정하지 않음
# 로컬 모델 자동 감지: diffusers/app/model/, yolo/app/data/ 사용

# 서버 실행
python main.py
# 또는
python -m uvicorn main:app --host 0.0.0.0 --port 8002
```

**확인**:
- 서버 시작 메시지 확인
- `http://localhost:8002/health` 접속하여 상태 확인
- `http://localhost:8002/docs` 접속하여 Swagger UI 확인

---

### 3단계: API Gateway 실행 (포트 8080)

**터미널 3**:
```bash
cd api.hohyun.site

# Gradle로 실행
./gradlew :gateway:bootRun
# Windows: gradlew.bat :gateway:bootRun
```

**또는 IDE에서 실행**:
- `api.hohyun.site/gateway/src/main/java/site/aiion/api/gateway/GatewayApplication.java` 실행

**환경 변수 설정** (`.env` 파일 또는 IDE Run Configuration):

```env
# 데이터베이스
SPRING_DATASOURCE_URL=your-neon-connection-string
SPRING_DATASOURCE_USERNAME=your-username
SPRING_DATASOURCE_PASSWORD=your-password

# Redis
SPRING_DATA_REDIS_HOST=your-redis-host
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-jwt-secret

# OAuth (선택사항)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
KAKAO_REST_API_KEY=your-kakao-key
KAKAO_CLIENT_SECRET=your-kakao-secret

# AI 서비스 URL (로컬 실행 시)
AI_SERVICE_RAG_URL=http://localhost:8001
AI_SERVICE_VISION_URL=http://localhost:8002
```

**확인**:
- 서버 시작 메시지 확인
- `http://localhost:8080/actuator/health` 접속하여 상태 확인
- `http://localhost:8080/docs` 접속하여 Swagger UI 확인

---

### 4단계: 프론트엔드 실행 (포트 3000)

**터미널 4**:
```bash
cd www.hohyun.site

# 의존성 설치
pnpm install

# 환경 변수 설정 (.env.local 파일 생성)
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
echo "NEXT_PUBLIC_CHAT_API_URL=http://localhost:8080" >> .env.local
echo "NEXT_PUBLIC_DIFFUSION_API_URL=http://localhost:8080" >> .env.local
echo "NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:8080" >> .env.local

# 개발 서버 실행
pnpm dev
```

**확인**:
- `http://localhost:3000` 접속하여 프론트엔드 확인

---

## 🧪 테스트 방법

### 1. Chat Service 직접 테스트

```bash
# Llama RAG 테스트
curl -X POST http://localhost:8001/rag/llama/rag \
  -H "Content-Type: application/json" \
  -d '{
    "question": "안녕하세요",
    "k": 3
  }'

# OpenAI RAG 테스트
curl -X POST http://localhost:8001/rag/openai/rag \
  -H "Content-Type: application/json" \
  -d '{
    "question": "안녕하세요",
    "k": 3
  }'
```

### 2. Vision Service 직접 테스트

```bash
# YOLO 테스트
curl -X POST http://localhost:8002/yolo/detect \
  -F "file=@test-image.jpg" \
  -F "detect_all_objects=true"

# Diffusers 테스트
curl -X POST http://localhost:8002/diffusers/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful landscape",
    "width": 1024,
    "height": 1024
  }'
```

### 3. API Gateway를 통한 테스트

```bash
# Chat Service (API Gateway 경유)
curl -X POST http://localhost:8080/api/rag/llama/rag \
  -H "Content-Type: application/json" \
  -d '{
    "question": "안녕하세요",
    "k": 3
  }'

# YOLO (API Gateway 경유)
curl -X POST http://localhost:8080/api/yolo/detect \
  -F "file=@test-image.jpg" \
  -F "detect_all_objects=true"

# Diffusers (API Gateway 경유)
curl -X POST http://localhost:8080/api/diffusers/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful landscape",
    "width": 1024,
    "height": 1024
  }'
```

### 4. 프론트엔드에서 테스트

1. 브라우저에서 `http://localhost:3000` 접속
2. 챗봇 페이지에서 메시지 전송
3. YOLO 페이지에서 이미지 업로드
4. Diffusers 페이지에서 이미지 생성

---

## 🔍 문제 해결

### Chat Service가 시작되지 않음

**문제**: 모델을 찾을 수 없음
```bash
Model directory not found: /path/to/model
```

**해결**:
1. 로컬 모델 경로 확인:
   ```bash
   ls -la chat.hohyun.site/llama/app/model/llama_ko
   ```

2. 환경 변수 설정:
   ```bash
   export LOCAL_MODEL_DIR="./llama/app/model/llama_ko"
   ```

3. 또는 S3 사용:
   ```bash
   export S3_MODEL_BUCKET=your-bucket-name
   export S3_MODEL_DIR_NAME=llama_ko
   export AWS_ACCESS_KEY_ID=your-key
   export AWS_SECRET_ACCESS_KEY=your-secret
   export AWS_REGION=ap-northeast-2
   ```

### Vision Service가 시작되지 않음

**문제**: 모델을 찾을 수 없음
```bash
로컬 모델을 찾을 수 없습니다.
```

**해결**:
1. Diffusers 모델 확인:
   ```bash
   ls -la vision.hohyun.site/diffusers/app/model/
   # model_index.json 파일이 있어야 함
   ```

2. YOLO 모델 확인:
   ```bash
   ls -la vision.hohyun.site/yolo/app/data/
   # yolo11n.pt 파일이 있어야 함
   ```

### API Gateway가 Chat/Vision Service에 연결되지 않음

**문제**: 503 Service Unavailable

**해결**:
1. 환경 변수 확인:
   ```bash
   # API Gateway 실행 전에 설정
   export AI_SERVICE_RAG_URL=http://localhost:8001
   export AI_SERVICE_VISION_URL=http://localhost:8002
   ```

2. 서비스가 실행 중인지 확인:
   ```bash
   curl http://localhost:8001/health
   curl http://localhost:8002/health
   ```

3. 포트 충돌 확인:
   ```bash
   # Windows
   netstat -ano | findstr :8001
   netstat -ano | findstr :8002
   netstat -ano | findstr :8080
   
   # Linux/Mac
   lsof -i :8001
   lsof -i :8002
   lsof -i :8080
   ```

### CORS 오류

**문제**: 브라우저 콘솔에 CORS 에러

**해결**:
1. Chat Service CORS 설정 확인:
   ```python
   # chat.hohyun.site/main.py
   allowed_origins = [
       "http://localhost:3000",
       "http://localhost:5000",
       "http://127.0.0.1:3000"
   ]
   ```

2. Vision Service CORS 설정 확인:
   ```python
   # vision.hohyun.site/main.py
   allowed_origins = [
       "http://localhost:3000",
       "http://localhost:5000",
       "http://127.0.0.1:3000"
   ]
   ```

3. API Gateway CORS 설정 확인:
   - `api.hohyun.site/gateway/src/main/java/site/aiion/api/gateway/config/CorsConfig.java` 확인

---

## 📝 체크리스트

로컬 테스트 전 확인 사항:

- [ ] Chat Service 모델 준비 (로컬 또는 S3)
- [ ] Vision Service 모델 준비 (Diffusers, YOLO)
- [ ] 데이터베이스 연결 정보 준비 (Neon PostgreSQL)
- [ ] Redis 연결 정보 준비 (Upstash Redis)
- [ ] OpenAI API 키 준비 (OpenAI 사용 시)
- [ ] 환경 변수 설정 완료
- [ ] 포트 충돌 없음 (8001, 8002, 8080, 3000)

---

## 🎯 빠른 시작 스크립트

### Windows (PowerShell)

```powershell
# Chat Service
cd chat.hohyun.site
$env:DATABASE_URL="your-database-url"
$env:OPENAI_API_KEY="your-key"
$env:LOCAL_MODEL_DIR="./llama/app/model/llama_ko"
python main.py

# Vision Service (새 터미널)
cd vision.hohyun.site
$env:DEVICE="cuda"
python main.py

# API Gateway (새 터미널)
cd api.hohyun.site
$env:AI_SERVICE_RAG_URL="http://localhost:8001"
$env:AI_SERVICE_VISION_URL="http://localhost:8002"
./gradlew :gateway:bootRun
```

### Linux/Mac (Bash)

```bash
# Chat Service
cd chat.hohyun.site
export DATABASE_URL="your-database-url"
export OPENAI_API_KEY="your-key"
export LOCAL_MODEL_DIR="./llama/app/model/llama_ko"
python main.py &

# Vision Service
cd vision.hohyun.site
export DEVICE="cuda"
python main.py &

# API Gateway
cd api.hohyun.site
export AI_SERVICE_RAG_URL="http://localhost:8001"
export AI_SERVICE_VISION_URL="http://localhost:8002"
./gradlew :gateway:bootRun
```

---

## ✅ 성공 확인

모든 서비스가 정상적으로 실행되면:

1. **Chat Service**: `http://localhost:8001/health` → `{"status": "healthy"}`
2. **Vision Service**: `http://localhost:8002/health` → `{"status": "healthy"}`
3. **API Gateway**: `http://localhost:8080/actuator/health` → `{"status": "UP"}`
4. **프론트엔드**: `http://localhost:3000` → 정상 로드

프론트엔드에서 챗봇, YOLO, Diffusers 기능이 모두 정상 작동하면 매핑이 올바르게 설정된 것입니다! ✅

