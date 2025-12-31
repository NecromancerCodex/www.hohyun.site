# EC2 배포 팁 및 체크리스트

## 📋 최종 구조

```
버셀 (Vercel) 
  ↓
가비아 (Gabia - 도메인/CDN)
  ↓
EC2:8080 (Spring API Gateway)
  ├── EC2:8000 (RAG AI 서비스)
  └── EC2:8001 (Diffusers AI 서비스)
```

## 🔧 1. 프록시 URL 변경 (중요!)

### 현재 문제점
현재 `AiServiceProxyController.java`는 Docker 컨테이너 이름을 사용:
- `http://yolo-service:8002`
- `http://rag-service:8000`
- `http://diffusers-service:8001`

### EC2 배포 시 수정 필요

**옵션 1: 환경 변수로 관리 (권장)**
```java
// AiServiceProxyController.java 수정
@Value("${ai.service.rag.url:http://localhost:8000}")
private String ragServiceUrl;

@Value("${ai.service.diffusers.url:http://localhost:8001}")
private String diffusersServiceUrl;

@Value("${ai.service.yolo.url:http://localhost:8002}")
private String yoloServiceUrl;
```

**옵션 2: application.yaml에 설정**
```yaml
# application.yaml
ai:
  service:
    rag:
      url: http://localhost:8000
    diffusers:
      url: http://localhost:8001
    yolo:
      url: http://localhost:8002
```

**옵션 3: 같은 EC2 인스턴스 내에서 localhost 사용**
- 같은 EC2 인스턴스에서 모든 서비스 실행 시 `localhost` 사용 가능
- Docker Compose 사용 시 네트워크 이름 유지 가능

## 🔒 2. 보안 그룹 설정

### EC2 보안 그룹 인바운드 규칙

```
Type          Protocol    Port Range    Source
HTTP          TCP         80            0.0.0.0/0
HTTPS         TCP         443           0.0.0.0/0
Custom TCP    TCP         8080          0.0.0.0/0  (게이트웨이)
Custom TCP    TCP         8000          127.0.0.1/32  (RAG - 내부만)
Custom TCP    TCP         8001          127.0.0.1/32  (Diffusers - 내부만)
Custom TCP    TCP         8002          127.0.0.1/32  (YOLO - 내부만)
SSH           TCP         22            Your IP
```

**⚠️ 중요**: AI 서비스(8000, 8001, 8002)는 게이트웨이를 통해서만 접근하도록 `127.0.0.1/32`로 제한

## 🌐 3. CORS 설정

### 게이트웨이 CORS 설정
```java
// CorsConfig.java
config.addAllowedOrigin("https://www.hohyun.site");  // 버셀 도메인
config.addAllowedOrigin("https://hohyun.site");      // 가비아 도메인
```

### AI 서비스 CORS 설정
```python
# RAG, Diffusers, YOLO 서비스
allowed_origins = [
    "https://www.hohyun.site",
    "https://hohyun.site",
    "http://localhost:3000"  # 개발용
]
```

## 🔐 4. 환경 변수 관리

### S3 모델 다운로드 설정 (Llama 모델)

Llama 모델이 S3에 있는 경우, 환경 변수 설정:

```bash
# .env 파일 또는 환경 변수
S3_MODEL_BUCKET=hohyun-llama-models
S3_MODEL_PREFIX=models/llama/
AWS_ACCESS_KEY_ID=your-access-key-id  # 선택사항 (IAM 역할 사용 시 불필요)
AWS_SECRET_ACCESS_KEY=your-secret-access-key  # 선택사항 (IAM 역할 사용 시 불필요)
AWS_REGION=ap-northeast-2
```

**권장**: EC2 IAM 역할 사용 (환경 변수 없이 자동 인증)
- EC2 인스턴스에 S3 읽기 권한이 있는 IAM 역할 연결
- 자세한 내용: `ai.hohyub.site/rag/scripts/README_S3_MODEL.md`

### EC2에서 환경 변수 설정 방법

**방법 1: .env 파일 (Docker Compose)**
```bash
# EC2 인스턴스에서
cd /opt/hohyun
nano .env

# 내용
NEON_CONNECTION_STRING=...
OPENAI_API_KEY=...
JWT_SECRET=...
ALLOWED_ORIGINS=https://www.hohyun.site,https://hohyun.site
```

**방법 2: systemd 환경 파일**
```bash
# /etc/systemd/system/gateway.service
[Service]
Environment="SPRING_PROFILES_ACTIVE=production"
Environment="NEON_CONNECTION_STRING=..."
Environment="OPENAI_API_KEY=..."
```

**방법 3: AWS Systems Manager Parameter Store (권장)**
```bash
# AWS CLI로 설정
aws ssm put-parameter \
  --name "/hohyun/prod/OPENAI_API_KEY" \
  --value "sk-..." \
  --type "SecureString"
```

## 📊 5. 헬스체크 설정

### 게이트웨이 헬스체크
```yaml
# application.yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
```

### AI 서비스 헬스체크
```python
# 각 AI 서비스에 /health 엔드포인트 추가
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "rag-service",
        "timestamp": datetime.now().isoformat()
    }
```

### AWS Application Load Balancer (선택사항)
- ALB를 사용하면 자동 헬스체크 가능
- 게이트웨이만 ALB 뒤에 배치

## 📝 6. 로그 관리

### Docker Compose 로그 설정
```yaml
# docker-compose.yaml
services:
  gateway:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### CloudWatch Logs 연동 (권장)
```bash
# EC2에서 CloudWatch Agent 설치
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm
```

## 🚀 7. 배포 스크립트

### deploy.sh 예시
```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# 1. 코드 업데이트
git pull origin main

# 2. 게이트웨이 빌드
cd api.hohyun.site
./gradlew :gateway:build -x test

# 3. Docker 이미지 빌드
cd ..
docker-compose build

# 4. 서비스 재시작
docker-compose up -d

# 5. 헬스체크
sleep 10
curl -f http://localhost:8080/actuator/health || exit 1

echo "✅ Deployment completed!"
```

## 💾 8. 리소스 관리

### EC2 인스턴스 타입 추천
- **게이트웨이**: t3.medium (2 vCPU, 4GB RAM)
- **RAG 서비스**: t3.large (2 vCPU, 8GB RAM) - 모델 로딩
- **Diffusers 서비스**: g4dn.xlarge (GPU 필요) - 이미지 생성

### 메모리 최적화
```yaml
# docker-compose.yaml
services:
  rag-service:
    deploy:
      resources:
        limits:
          memory: 6G
        reservations:
          memory: 4G
```

## 🔄 9. 무중단 배포

### Blue-Green 배포 전략
1. 새 버전을 다른 포트에서 실행 (8081, 8003, 8004)
2. 헬스체크 통과 확인
3. 로드밸런서/프록시에서 트래픽 전환
4. 이전 버전 종료

### Docker Compose 무중단 배포
```bash
# 새 컨테이너 시작
docker-compose up -d --scale gateway=2

# 헬스체크 후 이전 컨테이너 제거
docker-compose up -d --scale gateway=1
```

## 📈 10. 모니터링

### 필수 모니터링 항목
- **CPU 사용률**: 70% 이상 시 알림
- **메모리 사용률**: 80% 이상 시 알림
- **디스크 사용률**: 85% 이상 시 알림
- **응답 시간**: 5초 이상 시 알림
- **에러율**: 1% 이상 시 알림

### CloudWatch 대시보드 설정
```bash
# CloudWatch 메트릭 생성
aws cloudwatch put-metric-alarm \
  --alarm-name "Gateway-High-CPU" \
  --alarm-description "Alert when CPU exceeds 70%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold
```

## 🔐 11. 보안 체크리스트

- [ ] 모든 API 키를 환경 변수로 관리
- [ ] `.env` 파일을 `.gitignore`에 추가
- [ ] HTTPS 사용 (가비아 SSL 또는 Let's Encrypt)
- [ ] JWT 시크릿 키 강화 (최소 32자)
- [ ] 데이터베이스 연결 SSL 사용
- [ ] Redis 연결 SSL 사용
- [ ] AI 서비스 포트를 내부 전용으로 제한
- [ ] 정기적인 보안 업데이트

## 🐛 12. 문제 해결

### 게이트웨이에서 AI 서비스 연결 실패
```bash
# EC2에서 확인
curl http://localhost:8000/health  # RAG
curl http://localhost:8001/health  # Diffusers
curl http://localhost:8002/health  # YOLO
```

### CORS 오류
- 프론트엔드 도메인을 CORS 설정에 추가
- 가비아 도메인도 추가 필요

### 메모리 부족
```bash
# 메모리 확인
free -h

# Docker 컨테이너 메모리 사용량
docker stats
```

## 📚 13. 추가 권장사항

1. **자동 백업**: EBS 스냅샷 자동화
2. **로그 아카이빙**: S3로 로그 백업
3. **알림 설정**: SNS로 알림 수신
4. **비용 최적화**: Reserved Instance 사용 고려
5. **스케일링**: Auto Scaling Group 설정

## 🎯 빠른 체크리스트

배포 전 확인:
- [ ] 프록시 URL이 localhost로 변경됨
- [ ] 보안 그룹 포트 설정 완료
- [ ] CORS 도메인 추가 완료
- [ ] 환경 변수 설정 완료
- [ ] 헬스체크 엔드포인트 동작 확인
- [ ] 로그 설정 완료
- [ ] 모니터링 설정 완료

