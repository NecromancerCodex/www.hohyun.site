# Vercel 배포 설정 가이드

## 1. 환경 변수 설정 (선택사항)

현재 코드는 **가비아 DNS를 통해 자동으로 연결**되도록 설정되어 있어, Vercel 환경 변수 설정이 **필수는 아닙니다**.

프로덕션 환경에서는 자동으로 `http://api.hohyun.site:8000`으로 연결됩니다.

만약 다른 API 서버를 사용하고 싶다면, Vercel 환경 변수를 설정할 수 있지만, 현재는 하드코딩된 가비아 도메인을 사용합니다.

## 2. 가비아 도메인 설정 (선택사항)

가비아를 통해 Vercel과 EC2를 연결하는 경우:

1. **가비아 DNS 설정**
   - 가비아 관리 콘솔에서 A 레코드 또는 CNAME 레코드 설정
   - 예: `api.yourdomain.com` → EC2 Public IP 또는 EC2 도메인
   - SSL 인증서 설정 (Let's Encrypt 또는 가비아 SSL)

2. **EC2 보안 그룹에서 포트 열기**
   - HTTP (80) 및 HTTPS (443) 포트 열기
   - 또는 백엔드 포트 (8000)를 열고 가비아에서 리버스 프록시 설정

3. **프론트엔드 환경 변수 설정**
   - Vercel에서 `NEXT_PUBLIC_API_BASE_URL`에 가비아 API 도메인 입력
   - 예: `https://api.hohyun.site` (www가 아닌 api 서브도메인!)

## 3. EC2 보안 그룹 설정 확인

EC2 인스턴스의 보안 그룹에서 **포트 8000**이 열려있는지 확인하세요:

1. AWS Console → EC2 → Security Groups
2. 인스턴스에 연결된 보안 그룹 선택
3. **Inbound rules** 확인
4. 다음 규칙이 있어야 함:
   - **Type**: Custom TCP
   - **Port**: 8000
   - **Source**: 0.0.0.0/0 (또는 Vercel IP 범위)

## 4. EC2 Public IP/DNS 확인

GitHub Secrets의 `EC2_HOST` 값을 사용하거나, EC2 인스턴스의 Public IPv4 주소를 확인하세요.

## 5. 테스트

배포 후 다음 URL로 테스트:
- 프론트엔드: `https://your-vercel-app.vercel.app`
- 백엔드 Health Check: `http://ec2-13-125-108-162.ap-northeast-2.compute.amazonaws.com:8000/health`

## 6. 문제 해결

### CORS 오류
- 백엔드의 CORS 설정이 이미 `allow_origins=["*"]`로 되어 있으므로 문제 없어야 합니다.

### 연결 실패
- EC2 보안 그룹에서 포트 8000이 열려있는지 확인
- EC2 인스턴스가 실행 중인지 확인: `sudo systemctl status aiion-fastapi.service`
- 백엔드 Health Check: `curl http://ec2-13-125-108-162.ap-northeast-2.compute.amazonaws.com:8000/health`

