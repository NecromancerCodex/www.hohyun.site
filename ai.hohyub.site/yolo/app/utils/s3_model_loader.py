"""
S3에서 YOLO 모델을 직접 로드하는 유틸리티
EC2 볼륨 비용 절감을 위해 모델을 S3에서 직접 사용
"""
import os
import tempfile
import boto3
from pathlib import Path
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError


def get_s3_client():
    """S3 클라이언트 생성"""
    aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    aws_region = os.getenv("AWS_REGION", "ap-northeast-2")
    
    if aws_access_key_id and aws_secret_access_key:
        return boto3.client(
            "s3",
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=aws_region,
        )
    else:
        # IAM 역할 사용 (EC2에서)
        return boto3.client("s3", region_name=aws_region)


def load_yolo_model_from_s3(
    model_filename: str,
    bucket_name: Optional[str] = None,
    s3_prefix: Optional[str] = None,
    local_cache_dir: Optional[Path] = None,
) -> str:
    """
    S3에서 YOLO 모델 파일을 다운로드하여 로컬 경로 반환
    
    Args:
        model_filename: 모델 파일명 (예: "yolo11n.pt")
        bucket_name: S3 버킷 이름 (환경변수에서 가져옴)
        s3_prefix: S3 프리픽스 (예: "models/yolo/")
        local_cache_dir: 로컬 캐시 디렉토리 (None이면 임시 디렉토리 사용)
    
    Returns:
        로컬 모델 파일 경로
    """
    bucket_name = bucket_name or os.getenv("S3_MODEL_BUCKET")
    s3_prefix = s3_prefix or os.getenv("S3_MODEL_PREFIX", "models/yolo/")
    
    if not bucket_name:
        raise ValueError(
            "S3_MODEL_BUCKET 환경 변수가 설정되지 않았습니다. "
            "S3에서 모델을 로드할 수 없습니다."
        )
    
    # S3 키 구성
    if s3_prefix and not s3_prefix.endswith("/"):
        s3_prefix += "/"
    s3_key = f"{s3_prefix}{model_filename}"
    
    # 로컬 캐시 경로
    if local_cache_dir is None:
        # 임시 디렉토리 사용 (컨테이너 재시작 시 삭제됨)
        local_cache_dir = Path(tempfile.gettempdir()) / "s3_models" / "yolo"
    else:
        local_cache_dir = Path(local_cache_dir)
    
    local_cache_dir.mkdir(parents=True, exist_ok=True)
    
    # 로컬 파일 경로
    local_file = local_cache_dir / model_filename
    
    # 이미 다운로드되어 있으면 스킵
    if local_file.exists():
        print(f"✅ 모델이 이미 캐시되어 있습니다: {local_file}")
        return str(local_file)
    
    # S3에서 다운로드
    try:
        s3_client = get_s3_client()
        print(f"📥 S3에서 YOLO 모델 다운로드 중: s3://{bucket_name}/{s3_key}")
        
        # 파일 다운로드
        s3_client.download_file(bucket_name, s3_key, str(local_file))
        print(f"✅ 모델 다운로드 완료: {local_file}")
        
        return str(local_file)
    
    except NoCredentialsError:
        raise ValueError(
            "AWS 자격 증명을 찾을 수 없습니다. "
            "AWS_ACCESS_KEY_ID와 AWS_SECRET_ACCESS_KEY를 설정하거나 "
            "EC2 IAM 역할을 사용하세요."
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(
                f"S3에서 모델을 찾을 수 없습니다: s3://{bucket_name}/{s3_key}"
            )
        raise

