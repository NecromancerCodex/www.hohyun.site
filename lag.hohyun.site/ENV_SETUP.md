# 환경 변수 설정 가이드

## .env 파일 위치

Next.js에서 `.env` 파일은 **프로젝트 루트**에 위치해야 합니다.

### 옵션 1: front/.env (권장)

```
langchain/
└── front/
    ├── .env          ← 여기!
    ├── app/
    ├── package.json
    └── ...
```

`.env` 파일 내용:
```env
API_BASE_URL=http://api.hohyun.site:8000
```

### 옵션 2: 루트/.env

```
langchain/
├── .env              ← 또는 여기!
├── front/
│   ├── app/
│   └── ...
└── ...
```

## 중요 사항

### 1. 서버 재시작 필수

`.env` 파일을 수정하거나 추가한 후에는 **반드시 개발 서버를 재시작**해야 합니다:

```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
cd front
npm run dev
```

### 2. 환경 변수 로드 확인

프록시 코드가 환경 변수를 제대로 읽는지 확인:

```typescript
// front/app/api/proxy/route.ts에서
console.log('[Proxy] BACKEND_URL:', process.env.API_BASE_URL);
```

개발 서버 시작 시 콘솔에서 확인할 수 있습니다.

### 3. .gitignore 확인

`.env` 파일이 `.gitignore`에 포함되어 있는지 확인 (보안):

```bash
# front/.gitignore 확인
cat front/.gitignore | grep .env
```

## Vercel 배포 시

Vercel에서는 **환경 변수를 대시보드에서 설정**해야 합니다:

1. Vercel 대시보드 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables**
4. **Add New** 클릭
   - **Key**: `API_BASE_URL`
   - **Value**: `http://api.hohyun.site:8000`
   - **Environment**: Production, Preview, Development 모두 선택
5. **Save** 클릭
6. **Deployments** → **Redeploy** 실행 ⚠️ 필수!

## 테스트

### 로컬 개발

```bash
cd front

# .env 파일 확인
cat .env

# 개발 서버 시작
npm run dev

# 브라우저에서 http://localhost:3000 접속
# 메시지 전송하여 프록시 작동 확인
```

### 환경 변수 로드 확인

프록시에 접근하면 서버 콘솔에 로그가 출력됩니다:

```
[Proxy] Forwarding POST request to: http://api.hohyun.site:8000/rag
```

## 문제 해결

### 환경 변수가 로드되지 않음

1. **서버 재시작 확인**: `.env` 수정 후 서버 재시작 필수!
2. **파일 위치 확인**: `front/.env` 또는 루트 `.env`
3. **문법 확인**: `API_BASE_URL=http://api.hohyun.site:8000` (공백 없음, 따옴표 불필요)

### Vercel에서 환경 변수 작동 안 함

1. **환경 변수 설정 확인**: Vercel 대시보드에서 설정
2. **재배포 확인**: 환경 변수 설정 후 반드시 Redeploy
3. **변수명 확인**: `API_BASE_URL` (대소문자 구분)

