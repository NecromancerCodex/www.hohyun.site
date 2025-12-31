"""Multi-Task QLoRA Fine-tuning Script.

여러 태스크(카테고리 파싱, 감정 분석, MBTI, 빅파이브)를 하나의 모델에 훈련하는 스크립트입니다.
"""

from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from datasets import Dataset  # type: ignore  # noqa: F401

# Windows multiprocessing 문제 방지
os.environ["HF_DATASETS_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["CUDA_LAUNCH_BLOCKING"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["HF_DATASETS_MULTIPROCESSING_MAX_WORKERS"] = "0"
os.environ["HF_DATASETS_IN_MEMORY_MAX_SIZE"] = "0"
os.environ["DISABLE_MULTIPROCESSING"] = "1"

if sys.platform == "win32":
    import multiprocessing

    try:
        multiprocessing.set_start_method("spawn", force=True)
    except RuntimeError:
        pass

# ============================================================================
# Configuration
# ============================================================================

BASE_DIR: Path = Path(__file__).resolve().parent

BASE_MODEL_PATH = str(BASE_DIR / "model" / "llama_ko")
OUTPUT_ADAPTER_PATH = str(BASE_DIR / "model" / "llama_ko_multitask_adapter")

# 여러 태스크 데이터 파일 (없는 파일은 무시됨)
TRAINING_DATA_FILES = [
    str(BASE_DIR / "data" / "training_data_10000_improved.jsonl"),  # 카테고리 파싱
    str(BASE_DIR / "data" / "training_data_emotion.jsonl"),  # 감정 분석
    str(BASE_DIR / "data" / "training_data_mbti.jsonl"),  # MBTI 분석
    str(BASE_DIR / "data" / "training_data_big5.jsonl"),  # 빅파이브 분석
]

# 데이터 밸런싱 (각 태스크당 최대 샘플 수, None이면 모든 샘플 사용)
# ⚠️ 중요: 전체 훈련 시간을 줄이려면 이 값을 줄이세요
# 예: 3000 = 각 태스크당 최대 3000개 샘플 (총 최대 12000개)
# 예: 2000 = 각 태스크당 최대 2000개 샘플 (총 최대 8000개)
MAX_SAMPLES_PER_TASK: int | None = 2500  # 각 태스크당 2500개로 제한 (총 최대 10000개)
# None으로 설정하면 모든 샘플 사용 (훈련 시간 매우 길어짐)

# QLoRA 설정
MAX_SEQ_LENGTH = 768
LOAD_IN_4BIT = True
LORA_R = 8
LORA_ALPHA = 16
LORA_DROPOUT = 0.05

# 훈련 설정 (시간 절약을 위해 조정)
BATCH_SIZE = 1
GRADIENT_ACCUMULATION_STEPS = 8
NUM_EPOCHS = 1  # Multi-task는 1 epoch로 충분 (데이터가 많으므로)
LEARNING_RATE = 2e-4
WARMUP_STEPS = 10
LOGGING_STEPS = 10
SAVE_STEPS = 100
EVAL_STEPS = 100
OUTPUT_DIR = str(BASE_DIR / "output" / "multitask")


def load_training_data(file_path: str) -> list[dict[str, Any]]:
    """Load training data from JSONL file."""
    if not os.path.exists(file_path):
        return []

    samples = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line.strip():
                try:
                    sample = json.loads(line.strip())
                    samples.append(sample)
                except json.JSONDecodeError:
                    continue

    return samples


def identify_task(sample: dict[str, Any]) -> str:
    """Identify task type from system prompt."""
    messages = sample.get("messages", [])
    if not messages:
        return "unknown"

    # Find system message (usually first, but search to be safe)
    system_content = ""
    for msg in messages:
        if msg.get("role") == "system":
            system_content = msg.get("content", "")
            break

    if not system_content:
        return "unknown"

    # Check for task keywords in system prompt
    if "카테고리" in system_content or "일상 기록" in system_content:
        return "category"
    elif "감정" in system_content or "emotion" in system_content.lower():
        return "emotion"
    elif "MBTI" in system_content or "mbti" in system_content.lower():
        return "mbti"
    elif (
        "빅파이브" in system_content
        or "big5" in system_content.lower()
        or "big five" in system_content.lower()
    ):
        return "big5"
    else:
        return "unknown"


def load_multi_task_data(file_paths: list[str]) -> list[dict[str, Any]]:
    """Load and merge multiple training data files."""
    print("=" * 70)
    print("📖 Multi-Task 데이터 로딩")
    print("=" * 70)

    all_samples = []
    task_counts: dict[str, int] = {}

    for file_path in file_paths:
        if os.path.exists(file_path):
            samples = load_training_data(file_path)

            # 태스크별로 분류
            for sample in samples:
                task = identify_task(sample)
                task_counts[task] = task_counts.get(task, 0) + 1

            all_samples.extend(samples)
            print(f"✅ {os.path.basename(file_path)}: {len(samples):,} samples")
        else:
            print(f"⚠️  {os.path.basename(file_path)}: 파일 없음 (건너뜀)")

    print("\n📊 태스크별 샘플 수:")
    for task, count in sorted(task_counts.items()):
        print(f"   {task}: {count:,} samples")

    print(f"\n📊 총 샘플 수: {len(all_samples):,}")

    # 데이터 밸런싱
    if MAX_SAMPLES_PER_TASK and MAX_SAMPLES_PER_TASK > 0:
        print(f"\n⚖️  데이터 밸런싱 (최대 {MAX_SAMPLES_PER_TASK:,} samples per task)...")
        balanced_samples = balance_multi_task_data(all_samples, MAX_SAMPLES_PER_TASK)
        print(f"📊 밸런싱 후 샘플 수: {len(balanced_samples):,}")
        return balanced_samples

    return all_samples


def balance_multi_task_data(
    samples: list[dict[str, Any]], max_per_task: int
) -> list[dict[str, Any]]:
    """Balance samples across different tasks."""
    task_samples: dict[str, list[dict[str, Any]]] = {
        "category": [],
        "emotion": [],
        "mbti": [],
        "big5": [],
        "unknown": [],
    }

    for sample in samples:
        task = identify_task(sample)
        task_samples[task].append(sample)

    balanced_samples = []
    for task, task_data in task_samples.items():
        if len(task_data) > max_per_task:
            balanced_samples.extend(random.sample(task_data, max_per_task))
            print(f"   {task}: {len(task_data):,} → {max_per_task:,} samples")
        else:
            balanced_samples.extend(task_data)
            print(f"   {task}: {len(task_data):,} samples (모두 사용)")

    random.shuffle(balanced_samples)
    return balanced_samples


def format_chat_template(messages: list[dict[str, Any]]) -> str:
    """Format messages using Llama chat template.

    Args:
        messages: List of message dictionaries with 'role' and 'content' keys.

    Returns:
        Formatted text string using Llama's chat template format.
    """
    formatted_text = ""

    for msg in messages:
        role = str(msg.get("role", ""))
        content = str(msg.get("content", ""))

        if role == "system":
            formatted_text += (
                f"<|start_header_id|>system<|end_header_id|>\n\n{content}<|eot_id|>"
            )
        elif role == "user":
            formatted_text += (
                f"<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>"
            )
        elif role == "assistant":
            formatted_text += (
                f"<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>"
            )

    return formatted_text


def prepare_dataset(samples: list[dict[str, Any]], tokenizer: Any = None) -> Any:  # type: ignore[misc, no-untyped-def]  # noqa: ANN201
    """Prepare dataset for SFTTrainer.

    Uses tokenizer's chat template if available, otherwise falls back to manual formatting.
    """
    from datasets import Dataset  # type: ignore[import-untyped, name-defined]

    print("\n🔄 데이터셋 준비 중...")

    formatted_samples = []
    for idx, sample in enumerate(samples):
        messages = sample.get("messages", [])
        if not messages:
            continue

        # Use tokenizer's chat template if available (recommended)
        if (
            tokenizer
            and hasattr(tokenizer, "apply_chat_template")
            and tokenizer.chat_template
        ):
            try:
                text = tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=False
                )
            except Exception:
                # Fallback to manual formatting if tokenizer template fails
                text = format_chat_template(messages)
        else:
            # Manual formatting as fallback
            text = format_chat_template(messages)

        formatted_samples.append({"text": text})

        if (idx + 1) % 1000 == 0:
            print(f"   Processed {idx + 1:,}/{len(samples):,} samples...")

    dataset = Dataset.from_list(formatted_samples)  # type: ignore[name-defined]
    print(f"✅ Dataset prepared: {len(dataset):,} samples")

    return dataset


def validate_config() -> None:
    """Validate configuration parameters."""
    if MAX_SEQ_LENGTH <= 0:
        raise ValueError(f"MAX_SEQ_LENGTH must be positive, got {MAX_SEQ_LENGTH}")
    if BATCH_SIZE <= 0:
        raise ValueError(f"BATCH_SIZE must be positive, got {BATCH_SIZE}")
    if GRADIENT_ACCUMULATION_STEPS <= 0:
        raise ValueError(
            f"GRADIENT_ACCUMULATION_STEPS must be positive, got {GRADIENT_ACCUMULATION_STEPS}"
        )
    if NUM_EPOCHS <= 0:
        raise ValueError(f"NUM_EPOCHS must be positive, got {NUM_EPOCHS}")
    if LEARNING_RATE <= 0:
        raise ValueError(f"LEARNING_RATE must be positive, got {LEARNING_RATE}")
    if LORA_R <= 0:
        raise ValueError(f"LORA_R must be positive, got {LORA_R}")
    if not 0 <= LORA_DROPOUT < 1:
        raise ValueError(f"LORA_DROPOUT must be in [0, 1), got {LORA_DROPOUT}")


def print_trainable_parameters(model: Any) -> None:
    """Print the number of trainable parameters."""
    trainable_params = 0
    all_param = 0
    for _, param in model.named_parameters():
        all_param += param.numel()
        if param.requires_grad:
            trainable_params += param.numel()

    if all_param == 0:
        print("⚠️  Warning: Model has no parameters")
        return

    print(
        f"📊 Trainable params: {trainable_params:,} || "
        f"All params: {all_param:,} || "
        f"Trainable%: {100 * trainable_params / all_param:.2f}%"
    )


def main() -> None:
    """Main training function."""
    from datasets import disable_caching  # type: ignore
    from unsloth import FastLanguageModel, is_bfloat16_supported  # type: ignore

    disable_caching()

    import datasets  # type: ignore[import-untyped]

    datasets.config.IN_MEMORY_MAX_SIZE = 0  # type: ignore[attr-defined]
    datasets.config.MAX_SHARD_SIZE = "500MB"  # type: ignore[attr-defined]

    import functools

    original_map = datasets.Dataset.map  # type: ignore[attr-defined]

    @functools.wraps(original_map)
    def patched_map(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs["num_proc"] = None
        return original_map(self, *args, **kwargs)

    datasets.Dataset.map = patched_map  # type: ignore[attr-defined, assignment]
    print("🔧 Patched datasets.Dataset.map to force single-process execution")

    from transformers import TrainingArguments  # type: ignore[import,import-untyped]
    from trl import SFTTrainer  # type: ignore[import,import-untyped]

    validate_config()

    print("=" * 70)
    print("🚀 Multi-Task QLoRA Fine-tuning")
    print("=" * 70)
    print(f"📊 Base Model: {BASE_MODEL_PATH}")
    print(f"💾 Output Adapter: {OUTPUT_ADAPTER_PATH}")
    print(f"⚙️  Max Sequence Length: {MAX_SEQ_LENGTH}")
    print(f"📦 Batch Size: {BATCH_SIZE} × {GRADIENT_ACCUMULATION_STEPS}")
    print(f"📈 Epochs: {NUM_EPOCHS}")
    print(f"📚 Learning Rate: {LEARNING_RATE}")
    if MAX_SAMPLES_PER_TASK:
        print(f"⚖️  Max Samples per Task: {MAX_SAMPLES_PER_TASK:,}")
    print(f"🔧 QLoRA: 4-bit={LOAD_IN_4BIT}, r={LORA_R}, alpha={LORA_ALPHA}")
    print("=" * 70)
    print()

    # 1. Load Multi-Task Data
    samples = load_multi_task_data(TRAINING_DATA_FILES)
    if not samples:
        raise ValueError("No training samples loaded!")

    # 2. Load Model & Tokenizer (needed for chat template)
    print("📥 Loading model and tokenizer...")
    try:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=BASE_MODEL_PATH,
            max_seq_length=MAX_SEQ_LENGTH,
            dtype=None,
            load_in_4bit=LOAD_IN_4BIT,
            device_map={"": "cuda:0"},  # type: ignore[arg-type]
            max_memory={"cuda:0": "7GiB"},
            low_cpu_mem_usage=True,
        )
        print("✅ Model loaded successfully!")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        raise

    # 3. Prepare dataset with tokenizer for chat template
    train_dataset = prepare_dataset(samples, tokenizer=tokenizer)

    # 예상 훈련 시간 계산 (대략적)
    total_steps = (
        len(train_dataset) // (BATCH_SIZE * GRADIENT_ACCUMULATION_STEPS) * NUM_EPOCHS
    )
    estimated_hours = (
        total_steps * 0.04
    )  # 대략적인 스텝당 시간 (초) → 시간으로 변환 (40초/스텝 가정)
    print(f"⏰ 예상 훈련 시간: 약 {estimated_hours:.1f}시간 (대략적 추정)")
    print()

    # 4. Setup LoRA
    print("🔧 Setting up QLoRA (4-bit + LoRA)...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )
    print_trainable_parameters(model)

    # 5. Training Arguments
    training_args: Any = TrainingArguments(  # type: ignore[call-arg, annotation-unchecked]
        output_dir=OUTPUT_ADAPTER_PATH,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
        num_train_epochs=NUM_EPOCHS,
        learning_rate=LEARNING_RATE,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        warmup_steps=WARMUP_STEPS,
        logging_steps=LOGGING_STEPS,
        save_steps=SAVE_STEPS,
        save_strategy="steps",
        save_total_limit=3,
        seed=3407,
        report_to="none",
        max_grad_norm=1.0,
        gradient_checkpointing=True,
        dataloader_pin_memory=False,
        dataloader_num_workers=0,
    )

    # 6. SFT Trainer
    print("🔧 Setting up SFT Trainer...")
    trainer = SFTTrainer(  # type: ignore[call-arg, annotation-unchecked]
        model=model,
        train_dataset=train_dataset,
        args=training_args,
        processing_class=tokenizer,  # type: ignore[arg-type, annotation-unchecked]
        dataset_num_proc=None,
        max_seq_length=MAX_SEQ_LENGTH,
        dataset_text_field="text",
        packing=False,
        # NOTE: assistant_only_loss causes tensor size mismatch with Unsloth's fused loss
        # We compute loss on the full sequence instead
        dataset_kwargs={"num_proc": None},
    )

    # 7. Train
    print("\n" + "=" * 70)
    print("🎓 Starting training...")
    print("=" * 70)
    print()

    try:
        trainer_stats = trainer.train()
        print("\n✅ Training completed!")
        if hasattr(trainer_stats, "training_loss"):
            print(f"📊 Final loss: {trainer_stats.training_loss:.4f}")
    except KeyboardInterrupt:
        print("\n⚠️  Training interrupted by user")
        raise
    except Exception as e:
        print(f"\n❌ Training error: {e}")
        raise

    # 8. Save Adapter
    print(f"\n💾 Saving adapter to {OUTPUT_ADAPTER_PATH}...")
    model.save_pretrained(OUTPUT_ADAPTER_PATH)
    tokenizer.save_pretrained(OUTPUT_ADAPTER_PATH)
    print("✅ Adapter saved!")

    print("\n" + "=" * 70)
    print("🎉 Multi-Task QLoRA Fine-tuning complete!")
    print("=" * 70)
    print(f"📁 Adapter location: {OUTPUT_ADAPTER_PATH}/")
    print("=" * 70)


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    try:
        multiprocessing.set_start_method("spawn", force=True)
    except RuntimeError:
        pass

    main()
