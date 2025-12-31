"""Merge LoRA adapter with base model.

QLoRA 훈련이 완료된 후 어댑터를 베이스 모델과 병합하는 스크립트입니다.
병합된 모델은 Hugging Face Inference API에서 바로 사용할 수 있습니다.
"""

import os
import sys
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

BASE_DIR = Path(__file__).resolve().parent
BASE_MODEL_PATH = BASE_DIR / "model" / "llama_ko"
ADAPTER_PATH = BASE_DIR / "model" / "llama_ko_adapter"
MERGED_MODEL_PATH = BASE_DIR / "model" / "llama_ko_merged"


def merge_model():
    """Merge LoRA adapter with base model."""
    print("=" * 70)
    print("🔀 LoRA Adapter 병합 시작")
    print("=" * 70)
    print(f"📊 베이스 모델: {BASE_MODEL_PATH}")
    print(f"📁 어댑터: {ADAPTER_PATH}")
    print(f"💾 출력 경로: {MERGED_MODEL_PATH}")
    print("=" * 70)
    print()

    # 경로 확인
    if not BASE_MODEL_PATH.exists():
        print(f"❌ 베이스 모델을 찾을 수 없습니다: {BASE_MODEL_PATH}")
        sys.exit(1)

    if not ADAPTER_PATH.exists():
        print(f"❌ 어댑터를 찾을 수 없습니다: {ADAPTER_PATH}")
        sys.exit(1)

    # 출력 디렉토리 생성
    MERGED_MODEL_PATH.mkdir(parents=True, exist_ok=True)

    print("📥 모델 로딩 중...")
    print("⚠️  이 과정은 시간이 걸릴 수 있습니다...")

    try:
        from unsloth import FastLanguageModel
        import torch

        # GPU 메모리 확인
        if torch.cuda.is_available():
            print(f"✅ GPU 사용 가능: {torch.cuda.get_device_name(0)}")
            print(f"💾 GPU 메모리: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        else:
            print("⚠️  GPU를 사용할 수 없습니다. CPU에서 병합하면 매우 오래 걸립니다.")

        # 베이스 모델 로드 (병합을 위해 4bit 비활성화)
        print("\n1️⃣ 베이스 모델 로딩...")
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=str(BASE_MODEL_PATH),
            max_seq_length=768,  # 원래 훈련 시 사용한 값
            dtype=None,
            load_in_4bit=False,  # 병합을 위해 4bit 비활성화
            device_map="auto",
        )
        print("✅ 베이스 모델 로드 완료!")

        # 어댑터 로드
        print("\n2️⃣ 어댑터 로딩...")
        model.load_adapter(str(ADAPTER_PATH))
        print("✅ 어댑터 로드 완료!")

        # 어댑터 병합
        print("\n3️⃣ 어댑터 병합 중...")
        print("⚠️  이 과정은 몇 분이 걸릴 수 있습니다...")
        model = model.merge_and_unload()  # 어댑터를 베이스 모델에 병합
        print("✅ 어댑터 병합 완료!")

        # 병합된 모델 저장
        print("\n4️⃣ 병합된 모델 저장 중...")
        print("⚠️  대용량 파일 저장으로 시간이 걸릴 수 있습니다...")
        model.save_pretrained(str(MERGED_MODEL_PATH), safe_serialization=True)
        tokenizer.save_pretrained(str(MERGED_MODEL_PATH))
        print("✅ 병합된 모델 저장 완료!")

        # 결과 요약
        print("\n" + "=" * 70)
        print("🎉 병합 완료!")
        print("=" * 70)
        print(f"📁 병합된 모델 위치: {MERGED_MODEL_PATH}/")
        print()
        print("💡 다음 단계:")
        print("1. Hugging Face에 업로드:")
        print(f"   huggingface-cli upload your-username/model-name {MERGED_MODEL_PATH}/")
        print()
        print("2. 또는 Python으로 업로드:")
        print("   from huggingface_hub import HfApi")
        print(f"   api = HfApi()")
        print(f"   api.upload_folder(")
        print(f"       folder_path='{MERGED_MODEL_PATH}',")
        print(f"       repo_id='your-username/model-name',")
        print(f"       repo_type='model',")
        print(f"   )")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    merge_model()

