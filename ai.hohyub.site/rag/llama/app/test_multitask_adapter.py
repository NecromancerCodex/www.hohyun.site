"""Test script to verify multitask adapter is properly trained and loaded."""

import os
from pathlib import Path

# Windows multiprocessing 문제 방지
os.environ["HF_DATASETS_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

BASE_DIR = Path(__file__).resolve().parent
BASE_MODEL_PATH = str(BASE_DIR / "model" / "llama_ko")
ADAPTER_PATH = str(BASE_DIR / "model" / "llama_ko_multitask_adapter")
MAX_SEQ_LENGTH = 768

print("=" * 70)
print("🧪 Multi-Task Adapter 검증 테스트")
print("=" * 70)
print()

# 1. 파일 존재 확인
print("1️⃣ 파일 존재 확인...")
adapter_files = [
    "adapter_config.json",
    "adapter_model.safetensors",
    "special_tokens_map.json",
    "tokenizer_config.json",
    "tokenizer.json",
]

adapter_dir = Path(ADAPTER_PATH)
missing_files = []
for file in adapter_files:
    file_path = adapter_dir / file
    if file_path.exists():
        size = file_path.stat().st_size / (1024 * 1024)  # MB
        print(f"   ✅ {file}: {size:.2f} MB")
    else:
        print(f"   ❌ {file}: 없음")
        missing_files.append(file)

if missing_files:
    print(f"\n⚠️  누락된 파일: {', '.join(missing_files)}")
    print("훈련이 제대로 완료되지 않았을 수 있습니다.")
    exit(1)

print("\n✅ 모든 필수 파일이 존재합니다!")

# 2. 모델 로드 테스트
print("\n2️⃣ 모델 로드 테스트...")
try:
    from unsloth import FastLanguageModel  # type: ignore

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=ADAPTER_PATH,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,
        load_in_4bit=True,
        device_map={"": "cuda:0"},
        max_memory={"cuda:0": "7GiB"},
        low_cpu_mem_usage=True,
    )
    print("✅ 모델 로드 성공!")

    # 3. 간단한 추론 테스트 (4가지 태스크)
    print("\n3️⃣ 추론 테스트 (4가지 태스크)...")

    FastLanguageModel.for_inference(model)

    test_cases = [
        {
            "name": "카테고리 파싱",
            "messages": [
                {
                    "role": "system",
                    "content": "당신은 사용자의 일상 기록을 분석하여 다음 카테고리로 구조화하는 AI 어시스턴트입니다:\n\n1. **diaries**: 일기 형식의 내용\n2. **accounts**: 지출 기록 (금액, 항목, 날짜)\n3. **healthcare_records**: 건강 관련 기록 (통증, 운동, 병원 방문 등)\n4. **culture**: 문화 활동 (영화, 책, 전시회 등)\n5. **event**: 일정/이벤트 (회의, 약속, 예약 등)\n6. **task**: 할 일 목록\n\n사용자의 입력을 분석하여 해당하는 카테고리로 분류하고, JSON 형식으로 구조화하여 반환하세요.\n여러 카테고리에 해당하는 경우 모두 포함하세요."
                },
                {"role": "user", "content": "오늘 점심에 8000원 쓰고 파스타를 먹었다. 맛있었다."}
            ]
        },
        {
            "name": "감정 분석",
            "messages": [
                {
                    "role": "system",
                    "content": "일기 내용을 분석하여 감지된 상위 3개 감정을 퍼센트로 표시하세요. 형식: '감정1: XX%, 감정2: YY%, 감정3: ZZ%'"
                },
                {"role": "user", "content": "오늘 정말 행복한 하루였다. 친구들과 즐거운 시간을 보냈고 기분이 좋았다."}
            ]
        },
        {
            "name": "MBTI 분석",
            "messages": [
                {
                    "role": "system",
                    "content": "일기 내용을 분석하여 감지된 MBTI 성격 차원을 퍼센트로 표시하세요. 1개만 감지될 수도 있고, 여러 개가 감지될 수도 있으며, 감지되지 않을 수도 있습니다. 형식: 'MBTI1: XX%, MBTI2: YY%, MBTI3: ZZ%' 또는 '평가불가: 100%'"
                },
                {"role": "user", "content": "나는 계획을 세우는 것을 좋아한다. 여행 가기 전에 모든 일정을 미리 정해둔다."}
            ]
        },
        {
            "name": "빅파이브 분석",
            "messages": [
                {
                    "role": "system",
                    "content": "일기 내용을 분석하여 감지된 빅파이브 성격 특성을 퍼센트로 표시하세요. 1개만 감지될 수도 있고, 여러 개가 감지될 수도 있으며, 감지되지 않을 수도 있습니다. 형식: '특성1: XX%, 특성2: YY%, 특성3: ZZ%' 또는 '평가불가: 100%'"
                },
                {"role": "user", "content": "나는 새로운 것을 시도하는 것을 좋아한다. 모험적인 활동을 즐긴다."}
            ]
        }
    ]

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n   테스트 {i}: {test_case['name']}")
        print(f"   입력: {test_case['messages'][1]['content'][:50]}...")

        try:
            # Apply chat template
            text = tokenizer.apply_chat_template(
                test_case['messages'],
                tokenize=False,
                add_generation_prompt=True
            )

            inputs = tokenizer([text], return_tensors="pt").to("cuda")

            outputs = model.generate(
                **inputs,
                max_new_tokens=256,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                use_cache=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )

            response = tokenizer.decode(outputs[0], skip_special_tokens=True)
            # Extract only the generated part (after the input)
            response_parts = response.split("assistant\n\n")
            if len(response_parts) > 1:
                generated_text = response_parts[-1].split("<|eot_id|>")[0].strip()
            else:
                generated_text = response

            print(f"   출력: {generated_text[:100]}...")
            print(f"   ✅ 성공")

        except Exception as e:
            print(f"   ❌ 실패: {e}")

    print("\n" + "=" * 70)
    print("✅ Multi-Task Adapter 검증 완료!")
    print("=" * 70)
    print(f"📁 Adapter 위치: {ADAPTER_PATH}")
    print("=" * 70)

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

