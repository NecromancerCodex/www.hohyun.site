#!/usr/bin/env python3
"""
S3에서 Diffusers 모델을 다운로드하는 스크립트
EC2 배포 시 모델이 S3에 있으면 자동으로 다운로드
"""

import os
import sys
import boto3
from pathlib import Path
from botocore.exceptions import ClientError, NoCredentialsError

# 프로젝트 루트 경로 설정
script_dir = Path(__file__).parent.absolute()
diffusers_root = script_dir.parent  # diffusers/
model_dir = diffusers_root / "app" / "model"

def download_from_s3(
    bucket_name: str,
    s3_prefix: str,
    local_dir: Path,
    aws_access_key_id: str = None,
    aws_secret_access_key: str = None,
    aws_region: str = "ap-northeast-2"
):
    """
    S3에서 모델 파일들을 다운로드
    
    Args:
        bucket_name: S3 버킷 이름
        s3_prefix: S3 경로 prefix (예: "models/diffusers/")
        local_dir: 로컬 저장 디렉토리
        aws_access_key_id: AWS Access Key ID (환경 변수에서 가져올 수 있음)
        aws_secret_access_key: AWS Secret Access Key (환경 변수에서 가져올 수 있음)
        aws_region: AWS 리전
    """
    # AWS 자격 증명 설정
    if aws_access_key_id and aws_secret_access_key:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=aws_region
        )
    else:
        # 환경 변수 또는 IAM 역할 사용
        s3_client = boto3.client('s3', region_name=aws_region)
    
    try:
        # S3 버킷의 객체 목록 가져오기
        print(f"📦 S3에서 Diffusers 모델 다운로드 시작...")
        print(f"   버킷: {bucket_name}")
        print(f"   경로: {s3_prefix}")
        print(f"   저장 위치: {local_dir}")
        
        # 로컬 디렉토리 생성
        local_dir.mkdir(parents=True, exist_ok=True)
        
        # S3 객체 목록 가져오기
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket_name, Prefix=s3_prefix)
        
        downloaded_count = 0
        skipped_count = 0
        
        for page in pages:
            if 'Contents' not in page:
                continue
                
            for obj in page['Contents']:
                s3_key = obj['Key']
                file_size = obj['Size']
                
                # 디렉토리는 건너뛰기
                if s3_key.endswith('/'):
                    continue
                
                # 로컬 파일 경로 생성
                relative_path = s3_key[len(s3_prefix):].lstrip('/')
                local_file = local_dir / relative_path
                
                # 이미 파일이 있고 크기가 같으면 스킵
                if local_file.exists() and local_file.stat().st_size == file_size:
                    print(f"   ⏭️  스킵: {relative_path} (이미 존재)")
                    skipped_count += 1
                    continue
                
                # 디렉토리 생성
                local_file.parent.mkdir(parents=True, exist_ok=True)
                
                # 파일 다운로드
                print(f"   ⬇️  다운로드 중: {relative_path} ({file_size / 1024 / 1024:.2f} MB)")
                s3_client.download_file(bucket_name, s3_key, str(local_file))
                downloaded_count += 1
        
        print(f"\n✅ 다운로드 완료!")
        print(f"   다운로드: {downloaded_count}개 파일")
        print(f"   스킵: {skipped_count}개 파일")
        
        return True
        
    except NoCredentialsError:
        print("❌ AWS 자격 증명을 찾을 수 없습니다.")
        print("   환경 변수 설정:")
        print("   - AWS_ACCESS_KEY_ID")
        print("   - AWS_SECRET_ACCESS_KEY")
        print("   또는 EC2 IAM 역할 설정")
        return False
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ S3 버킷을 찾을 수 없습니다: {bucket_name}")
        elif error_code == 'AccessDenied':
            print(f"❌ S3 버킷 접근 권한이 없습니다: {bucket_name}")
        else:
            print(f"❌ S3 오류: {e}")
        return False
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """메인 함수"""
    # 환경 변수에서 설정 가져오기
    bucket_name = os.getenv('S3_MODEL_BUCKET')
    s3_prefix = os.getenv('S3_MODEL_PREFIX', 'models/diffusers/')
    aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_region = os.getenv('AWS_REGION', 'ap-northeast-2')
    
    # S3 버킷이 설정되지 않았으면 스킵
    if not bucket_name:
        print("⚠️  S3_MODEL_BUCKET 환경 변수가 설정되지 않았습니다.")
        print("   모델 다운로드를 건너뜁니다.")
        print("   로컬 모델 디렉토리를 확인합니다...")
        
        # 로컬 모델 디렉토리 확인
        if model_dir.exists() and any(model_dir.iterdir()):
            print(f"✅ 로컬 모델이 존재합니다: {model_dir}")
            return 0
        else:
            print(f"❌ 로컬 모델이 없습니다: {model_dir}")
            print("   S3_MODEL_BUCKET 환경 변수를 설정하거나 모델을 수동으로 배치하세요.")
            return 1
    
    # 모델 다운로드 실행
    success = download_from_s3(
        bucket_name=bucket_name,
        s3_prefix=s3_prefix,
        local_dir=model_dir,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_region=aws_region
    )
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

