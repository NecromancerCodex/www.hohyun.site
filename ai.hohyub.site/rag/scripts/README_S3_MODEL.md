# S3에서 Llama 모델 다운로드 가이드

## 📋 개요

Llama 모델이 너무 커서 Docker 이미지에 포함하기 어려운 경우, S3에 모델을 저장하고 배포 시 자동으로 다운로드하도록 설정할 수 있습니다.

## 🚀 설정 방법

### 1. S3 버킷 준비

1. AWS S3에서 버킷 생성 (예: `hohyun-llama-models`)
2. 모델 파일을 S3에 업로드:
   ```
   s3://hohyun-llama-models/models/llama/
   ├── llama_ko/
   │   ├── config.json
   │   ├── model-00001-of-00004.safetensors
   │   ├── model-00002-of-00004.safetensors
   │   ├── model-00003-of-00004.safetensors
   │   ├── model-00004-of-00004.safetensors
   │   ├── model.safetensors.index.json
   │   └── ...
   ├── llama_ko_adapter/
   │   └── ...
   └── llama_ko_multitask_adapter/
       └── ...
   ```

### 2. 환경 변수 설정

#### Docker Compose 사용 시

`.env` 파일에 추가:
```bash
# S3 모델 다운로드 설정
S3_MODEL_BUCKET=hohyun-llama-models
S3_MODEL_PREFIX=models/llama/
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-northeast-2
```

#### EC2 배포 시

환경 변수 설정:
```bash
export S3_MODEL_BUCKET=hohyun-llama-models
export S3_MODEL_PREFIX=models/llama/
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=ap-northeast-2
```

또는 EC2 IAM 역할 사용 (권장):
- EC2 인스턴스에 S3 읽기 권한이 있는 IAM 역할 연결
- 환경 변수 없이 자동으로 IAM 역할 사용

### 3. IAM 역할 설정 (권장)

EC2 인스턴스에 IAM 역할을 연결하면 환경 변수 없이도 S3 접근 가능:

1. AWS IAM 콘솔에서 역할 생성
2. 다음 정책 추가:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::hohyun-llama-models",
        "arn:aws:s3:::hohyun-llama-models/*"
      ]
    }
  ]
}
```
3. EC2 인스턴스에 역할 연결

## 🔄 동작 방식

1. **컨테이너 시작 시**:
   - `download_model_from_s3.py` 스크립트 실행
   - S3에서 모델 다운로드 (이미 있으면 스킵)
   - 다운로드 완료 후 FastAPI 서버 시작

2. **모델 다운로드 스킵 조건**:
   - `S3_MODEL_BUCKET` 환경 변수가 설정되지 않음
   - 로컬에 모델이 이미 존재하고 크기가 동일함

3. **에러 처리**:
   - S3 접근 실패 시 에러 메시지 출력
   - 로컬 모델이 있으면 계속 진행
   - 로컬 모델이 없으면 서버 시작 실패

## 📝 사용 예시

### 수동 다운로드

```bash
# 스크립트 직접 실행
cd ai.hohyub.site/rag
python scripts/download_model_from_s3.py
```

### Docker Compose로 실행

```bash
# 환경 변수 설정 후
docker-compose up rag-service
```

### EC2에서 실행

```bash
# 환경 변수 설정
export S3_MODEL_BUCKET=hohyun-llama-models
export S3_MODEL_PREFIX=models/llama/

# Docker Compose 실행
docker-compose up -d rag-service
```

## ⚠️ 주의사항

1. **모델 크기**: Llama 모델은 수 GB 크기이므로 다운로드에 시간이 걸릴 수 있습니다.
2. **네트워크 비용**: S3에서 EC2로 데이터 전송 시 네트워크 비용이 발생합니다.
3. **디스크 공간**: EC2 인스턴스에 충분한 디스크 공간이 필요합니다.
4. **보안**: AWS 자격 증명은 환경 변수로 관리하거나 IAM 역할을 사용하세요.

## 🔍 문제 해결

### 모델 다운로드 실패

```bash
# 로그 확인
docker-compose logs rag-service

# 수동 다운로드 테스트
docker-compose exec rag-service python scripts/download_model_from_s3.py
```

### 권한 오류

- IAM 역할이 올바르게 연결되었는지 확인
- S3 버킷 정책이 올바른지 확인
- AWS 자격 증명이 올바른지 확인

### 디스크 공간 부족

```bash
# 디스크 사용량 확인
df -h

# 모델 디렉토리 크기 확인
du -sh ai.hohyub.site/rag/llama/app/model
```

## 📚 참고

- [AWS S3 Python SDK (boto3) 문서](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- [EC2 IAM 역할 설정](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)

