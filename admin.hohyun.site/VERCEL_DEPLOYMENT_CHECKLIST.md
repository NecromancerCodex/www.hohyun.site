# Admin Site Vercel 배포 체크리스트

## ✅ 수정 완료 사항

### 1. ESLint 설정 수정
- **문제**: `eslint.config.mjs` 형식이 Next.js 15/16과 호환되지 않음
- **해결**: `.eslintrc.json`으로 변경 (Next.js 기본 설정 사용)

### 2. useSearchParams Suspense Boundary
- **상태**: ✅ 이미 완료됨
- **위치**: `src/app/dashboard/page.tsx` - 이미 Suspense로 감싸져 있음

### 3. substr → slice 변경
- **문제**: `substr`는 deprecated
- **해결**: `slice`로 변경
- **위치**: `src/service/mainservice.ts`

### 4. TypeScript 타겟 업그레이드
- **변경**: `ES2017` → `ES2018`
- **이유**: 최신 기능 지원 및 Next.js 16 호환성

### 5. Next.js 보안 업데이트
- **변경**: `16.0.3` → `16.0.7`
- **이유**: CVE-2025-66478 (React2Shell) 보안 취약점 패치
- **eslint-config-next**: `16.0.3` → `16.0.7` (버전 동기화)

---

## 📋 배포 전 확인 사항

### 필수 확인
- [x] ESLint 설정 수정 완료
- [x] useSearchParams Suspense boundary 확인
- [x] deprecated 메서드 제거 (substr)
- [x] TypeScript 타겟 업데이트
- [x] Next.js 보안 업데이트

### 추가 확인 (선택사항)
- [ ] 환경 변수 설정 확인
- [ ] API 엔드포인트 확인
- [ ] 빌드 테스트 (`pnpm run build`)

---

## 🚀 배포 단계

### 1. 의존성 재설치
```bash
cd admin.hohyun.site
pnpm install
```

### 2. 로컬 빌드 테스트
```bash
pnpm run build
```

### 3. 변경사항 커밋 및 푸시
```bash
git add .
git commit -m "Fix: Vercel deployment - ESLint, TypeScript, Next.js security update"
git push
```

### 4. Vercel 배포
- GitHub에 푸시하면 자동 배포 시작
- 또는 Vercel 대시보드에서 수동 배포

---

## 📝 변경된 파일 목록

1. `package.json` - Next.js 및 eslint-config-next 버전 업데이트
2. `.eslintrc.json` - 새로 생성 (eslint.config.mjs 삭제)
3. `eslint.config.mjs` - 삭제됨
4. `tsconfig.json` - target ES2018로 업데이트
5. `src/service/mainservice.ts` - substr → slice 변경

---

## ✅ 배포 준비 완료

모든 수정이 완료되었습니다. Vercel에 배포할 준비가 되었습니다!

