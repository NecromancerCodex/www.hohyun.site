import torch
from diffusers import (
    AutoPipelineForText2Image,
    StableDiffusionXLPipeline,
    StableDiffusionXLImg2ImgPipeline,
    UNet2DConditionModel,
    AutoencoderKL,
    DPMSolverMultistepScheduler,
    EulerDiscreteScheduler,
)
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer
from safetensors import safe_open
from app.diffusers.core.config import MODEL_ID, DEVICE, DTYPE, HF_CACHE_DIR, SCHEDULER_TYPE, USE_KARRAS, USE_REFINER, DEFAULT_REFINER_STRENGTH

_PIPELINE = None
_PIPELINE_LOADED = False  # 파이프라인 로드 여부 추적
_CURRENT_MODEL_ID = None  # 현재 사용 중인 모델 ID
_REFINER_PIPELINE = None
_REFINER_LOADED = False  # Refiner 파이프라인 로드 여부 추적

def _torch_dtype():
    """설정에 따른 torch dtype 반환"""
    if DTYPE.lower() == "float16":
        return torch.float16
    if DTYPE.lower() == "bfloat16":
        return torch.bfloat16
    return torch.float32

def _load_from_single_files(model_dir):
    """
    단일 safetensors 파일에서 SDXL 파이프라인 로드
    - sd_xl_base_1.0.safetensors: UNet
    - sdxl.vae.safetensors: VAE
    - text_encoder, text_encoder_2: 로컬 모델에서 로드
    """
    from pathlib import Path
    model_path = Path(model_dir)
    dtype = _torch_dtype()
    
    print("📦 단일 safetensors 파일 형식으로 로드 중...")
    
    # 1. Text Encoders (로컬 모델에서 로드)
    print("  [1/4] Text Encoders 로드 중 (로컬)...")
    if (model_path / "text_encoder").exists() and (model_path / "text_encoder_2").exists():
        # 로컬에 표준 형식이 있으면 로컬 사용
        text_encoder = CLIPTextModel.from_pretrained(
            str(model_path),
            subfolder="text_encoder",
            torch_dtype=dtype,
            local_files_only=True,
        )
        text_encoder_2 = CLIPTextModelWithProjection.from_pretrained(
            str(model_path),
            subfolder="text_encoder_2",
            torch_dtype=dtype,
            local_files_only=True,
        )
        tokenizer = CLIPTokenizer.from_pretrained(
            str(model_path),
            subfolder="tokenizer",
            local_files_only=True,
        )
        tokenizer_2 = CLIPTokenizer.from_pretrained(
            str(model_path),
            subfolder="tokenizer_2",
            local_files_only=True,
        )
        print("  ✅ Text Encoders 로드 완료 (로컬)")
    else:
        raise FileNotFoundError(
            f"로컬 Text Encoders를 찾을 수 없습니다: {model_path}/text_encoder, {model_path}/text_encoder_2\n"
            "표준 diffusers 형식의 로컬 모델이 필요합니다."
        )
    
    # 2. UNet (로컬 safetensors 파일에서 로드)
    print("  [2/4] UNet 로드 중...")
    unet_path = model_path / "sd_xl_base_1.0.safetensors"
    if not unet_path.exists():
        raise FileNotFoundError(f"UNet 파일을 찾을 수 없습니다: {unet_path}")
    
    # UNet config는 로컬 모델에서 가져오기
    if (model_path / "unet").exists():
        unet = UNet2DConditionModel.from_pretrained(
            str(model_path),
            subfolder="unet",
            torch_dtype=dtype,
            local_files_only=True,
        )
    else:
        raise FileNotFoundError(
            f"로컬 UNet을 찾을 수 없습니다: {model_path}/unet\n"
            "표준 diffusers 형식의 로컬 모델이 필요합니다."
        )
    
    # 로컬 safetensors 파일에서 가중치 로드
    # sd_xl_base_1.0.safetensors는 전체 파이프라인 가중치를 포함할 수 있음
    # UNet 모델의 키 구조 확인
    unet_model_keys = set(unet.state_dict().keys())
    
    # 로컬 파일에서 모든 키 로드
    file_state_dict = {}
    with safe_open(str(unet_path), framework="pt", device="cpu") as f:
        for key in f.keys():
            file_state_dict[key] = f.get_tensor(key)
    
    # UNet 모델 키와 매칭
    unet_state_dict = {}
    matched_count = 0
    
    # 1. 직접 매칭 시도
    for model_key in unet_model_keys:
        if model_key in file_state_dict:
            unet_state_dict[model_key] = file_state_dict[model_key]
            matched_count += 1
        # 2. ComfyUI 형식 변환 시도 (model.diffusion_model. -> )
        elif f"model.diffusion_model.{model_key}" in file_state_dict:
            unet_state_dict[model_key] = file_state_dict[f"model.diffusion_model.{model_key}"]
            matched_count += 1
        # 3. diffusion_model. 접두사 제거 시도
        elif f"diffusion_model.{model_key}" in file_state_dict:
            unet_state_dict[model_key] = file_state_dict[f"diffusion_model.{model_key}"]
            matched_count += 1
    
    print(f"  📊 키 매칭: {matched_count}/{len(unet_model_keys)}개")
    
    # 로드된 키 확인
    missing_keys, unexpected_keys = unet.load_state_dict(unet_state_dict, strict=False)
    if len(missing_keys) > 100:  # 너무 많으면 일부만 출력
        print(f"  ⚠️  UNet 누락된 키: {len(missing_keys)}개 (일부는 정상일 수 있음)")
        print(f"      샘플: {list(missing_keys)[:5]}")
    elif missing_keys:
        print(f"  ⚠️  UNet 누락된 키: {len(missing_keys)}개")
    if unexpected_keys:
        print(f"  ⚠️  UNet 예상치 못한 키: {len(unexpected_keys)}개")
    print(f"  ✅ UNet 로드 완료")
    
    # 3. VAE (로컬 safetensors 파일에서 로드)
    print("  [3/4] VAE 로드 중...")
    vae_path = model_path / "sdxl.vae.safetensors"
    if not vae_path.exists():
        raise FileNotFoundError(f"VAE 파일을 찾을 수 없습니다: {vae_path}")
    
    # VAE는 로컬 모델에서 로드
    if (model_path / "vae").exists():
        # 표준 diffusers 형식 VAE 사용
        vae = AutoencoderKL.from_pretrained(
            str(model_path),
            subfolder="vae",
            torch_dtype=dtype,
            local_files_only=True,
        )
    else:
        # 단일 파일 형식 VAE 사용
        vae_config_path = model_path / "config.json"
        if vae_config_path.exists():
            # 로컬 config 사용
            import json
            vae_config = json.loads(vae_config_path.read_text())
            # _class_name, _diffusers_version 등 제거
            vae_config_clean = {k: v for k, v in vae_config.items() if not k.startswith('_')}
            vae = AutoencoderKL(**vae_config_clean)
        else:
            raise FileNotFoundError(
                f"로컬 VAE를 찾을 수 없습니다: {model_path}/vae 또는 {model_path}/config.json\n"
                "표준 diffusers 형식의 로컬 모델이 필요합니다."
            )
    
    # 로컬 safetensors 파일에서 가중치 로드
    # VAE 모델의 키 구조 확인
    vae_model_keys = set(vae.state_dict().keys())
    
    # 로컬 파일에서 모든 키 로드
    file_state_dict = {}
    with safe_open(str(vae_path), framework="pt", device="cpu") as f:
        for key in f.keys():
            file_state_dict[key] = f.get_tensor(key)
    
    # VAE 모델 키와 매칭
    vae_state_dict = {}
    matched_count = 0
    
    # 1. 직접 매칭 시도
    for model_key in vae_model_keys:
        if model_key in file_state_dict:
            vae_state_dict[model_key] = file_state_dict[model_key]
            matched_count += 1
        # 2. first_stage_model. 접두사 제거 시도
        elif f"first_stage_model.{model_key}" in file_state_dict:
            vae_state_dict[model_key] = file_state_dict[f"first_stage_model.{model_key}"]
            matched_count += 1
        # 3. model. 접두사 제거 시도
        elif f"model.{model_key}" in file_state_dict:
            vae_state_dict[model_key] = file_state_dict[f"model.{model_key}"]
            matched_count += 1
    
    print(f"  📊 키 매칭: {matched_count}/{len(vae_model_keys)}개")
    
    # 로드된 키 확인
    missing_keys, unexpected_keys = vae.load_state_dict(vae_state_dict, strict=False)
    if len(missing_keys) > 50:  # 너무 많으면 일부만 출력
        print(f"  ⚠️  VAE 누락된 키: {len(missing_keys)}개 (일부는 정상일 수 있음)")
        print(f"      샘플: {list(missing_keys)[:5]}")
    elif missing_keys:
        print(f"  ⚠️  VAE 누락된 키: {len(missing_keys)}개")
    if unexpected_keys:
        print(f"  ⚠️  VAE 예상치 못한 키: {len(unexpected_keys)}개")
    # VAE dtype 설정 (경고 방지)
    # VAE는 디코딩 시 float32가 필요할 수 있으므로 명시적으로 설정
    vae = vae.to(dtype=dtype)
    # upcast_vae deprecation 경고 방지를 위해 명시적으로 처리
    if hasattr(vae, 'enable_slicing'):
        vae.enable_slicing()
    if hasattr(vae, 'enable_tiling'):
        vae.enable_tiling()
    print(f"  ✅ VAE 로드 완료")
    
    # 4. Scheduler (로컬 모델에서 로드)
    print("  [4/4] Scheduler 로드 중 (로컬)...")
    if (model_path / "scheduler").exists():
        if SCHEDULER_TYPE == "dpm++" and USE_KARRAS:
            # DPM++ 2M Karras (고품질 조합)
            scheduler = DPMSolverMultistepScheduler.from_pretrained(
                str(model_path),
                subfolder="scheduler",
                local_files_only=True,
            )
            # Karras 시그마 스케줄 적용
            scheduler = DPMSolverMultistepScheduler.from_config(
                scheduler.config,
                use_karras=True,
            )
            print("  ✅ DPM++ Multistep Scheduler (Karras) 로드 완료 (로컬)")
        else:
            # Euler (기본)
            scheduler = EulerDiscreteScheduler.from_pretrained(
                str(model_path),
                subfolder="scheduler",
                local_files_only=True,
            )
            print("  ✅ Euler Discrete Scheduler 로드 완료 (로컬)")
    else:
        raise FileNotFoundError(
            f"로컬 Scheduler를 찾을 수 없습니다: {model_path}/scheduler\n"
            "표준 diffusers 형식의 로컬 모델이 필요합니다."
        )
    
    # 파이프라인 구성
    print("🔧 파이프라인 구성 중...")
    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )
    
    return pipe

def get_pipeline():
    """
    SDXL 파이프라인 싱글톤 로드 및 최적화
    RTX 4060 8GB 환경에 최적화됨
    단일 safetensors 파일 형식 지원
    """
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE

    print(f"🔄 모델 로딩 중: {MODEL_ID}")
    dtype = _torch_dtype()

    # 로컬 모델인지 Hugging Face 모델인지 확인
    from pathlib import Path
    model_path = Path(MODEL_ID)
    is_local = model_path.exists() and (model_path / "model_index.json").exists()
    
    if is_local:
        print(f"📁 로컬 모델 경로 사용: {MODEL_ID}")
        
        # 표준 diffusers 형식 확인 (우선)
        has_text_encoder = (model_path / "text_encoder").exists()
        has_unet = (model_path / "unet").exists()
        has_vae = (model_path / "vae").exists()
        
        # 단일 safetensors 파일 형식 확인 (대체)
        has_unet_file = (model_path / "sd_xl_base_1.0.safetensors").exists()
        has_vae_file = (model_path / "sdxl.vae.safetensors").exists()
        
        if has_text_encoder and has_unet and has_vae:
            # 표준 diffusers 형식으로 로드 (완전 로컬)
            print("  📦 표준 diffusers 형식으로 로드 (완전 로컬)")
            try:
                # VAE: sdxl.vae.safetensors 우선 사용 (색감 보존)
                # 단일 파일 형식의 VAE가 있으면 우선 사용
                vae_single_file = model_path / "sdxl.vae.safetensors"
                if vae_single_file.exists():
                    print("  🎨 sdxl.vae.safetensors 사용 (색감 보존)")
                    # VAE를 단일 파일에서 로드
                    from diffusers import AutoencoderKL
                    vae = AutoencoderKL.from_pretrained(
                        MODEL_ID,
                        subfolder="vae",
                        torch_dtype=dtype,
                        local_files_only=True,
                    )
                    # sdxl.vae.safetensors에서 가중치 로드
                    from safetensors import safe_open
                    vae_state_dict = {}
                    with safe_open(str(vae_single_file), framework="pt", device="cpu") as f:
                        for key in f.keys():
                            if key.startswith("first_stage_model."):
                                vae_state_dict[key.replace("first_stage_model.", "")] = f.get_tensor(key)
                            elif key.startswith("vae."):
                                vae_state_dict[key[4:]] = f.get_tensor(key)
                            elif key.startswith("model."):
                                vae_state_dict[key[6:]] = f.get_tensor(key)
                            else:
                                vae_state_dict[key] = f.get_tensor(key)
                    vae.load_state_dict(vae_state_dict, strict=False)
                    vae = vae.to(dtype=dtype)
                    
                    # 나머지 컴포넌트는 표준 형식으로 로드
                    pipe = AutoPipelineForText2Image.from_pretrained(
                        MODEL_ID,
                        torch_dtype=dtype,
                        variant=None,
                        use_safetensors=True,
                        local_files_only=True,
                    )
                    # VAE 교체
                    pipe.vae = vae
                else:
                    # 표준 형식 VAE 사용
                    pipe = AutoPipelineForText2Image.from_pretrained(
                        MODEL_ID,
                        torch_dtype=dtype,  # dtype 변수 사용 (float16으로 메모리 절약)
                        variant=None,
                        use_safetensors=True,
                        local_files_only=True,  # 로컬 파일만 사용
                    )
                
                # torch_dtype으로 이미 로드되었으므로 추가 변환 불필요
                # (from_pretrained의 torch_dtype 파라미터가 이미 모든 컴포넌트에 적용됨)
                
                # Karras 스케줄러 적용 (표준 형식)
                if SCHEDULER_TYPE == "dpm++" and USE_KARRAS:
                    print("  🔥 Karras 스케줄러 적용 중...")
                    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
                        pipe.scheduler.config,
                        use_karras=True,
                    )
                    print("  ✅ DPM++ Multistep Scheduler (Karras) 적용 완료")
            except Exception as e:
                print(f"  ❌ 표준 형식 로드 실패: {e}")
                print("  💡 download_model_local.py를 실행하여 모든 컴포넌트를 다운로드하세요.")
                raise
        elif has_unet_file and has_vae_file:
            # 단일 safetensors 파일 형식으로 로드 (Text Encoders는 로컬에서)
            print("  📦 단일 safetensors 파일 형식으로 로드 (Text Encoders는 로컬에서)")
            try:
                pipe = _load_from_single_files(model_path)
            except Exception as e:
                print(f"  ❌ 단일 파일 형식 로드 실패: {e}")
                import traceback
                traceback.print_exc()
                raise
        else:
            raise ValueError(
                "로컬 모델 구조를 찾을 수 없습니다.\n"
                "다음 중 하나의 형식이 필요합니다:\n"
                "  1. 표준 diffusers 형식: text_encoder/, unet/, vae/ 폴더\n"
                "  2. 단일 파일 형식: sd_xl_base_1.0.safetensors, sdxl.vae.safetensors\n"
                "download_model_local.py를 실행하여 표준 형식으로 다운로드하세요."
            )
    else:
        # 로컬 모델만 사용하도록 설정되어 있으므로 에러 발생
        raise ValueError(
            f"로컬 모델을 찾을 수 없습니다: {MODEL_ID}\n"
            "로컬 모델만 사용하도록 설정되어 있습니다.\n"
            f"로컬 모델 경로 확인: {LOCAL_MODEL_DIR}\n"
            "표준 diffusers 형식의 로컬 모델이 필요합니다."
        )

    # ✅ RTX 4060 8GB 최적화 옵션
    
    # 1. xFormers 메모리 효율적 어텐션 (가장 중요!)
    try:
        pipe.enable_xformers_memory_efficient_attention()
        print("✅ xFormers 메모리 최적화 활성화")
    except Exception as e:
        print(f"⚠️  xFormers 활성화 실패: {e}")
        # xFormers 실패 시 attention slicing 사용
        try:
            pipe.enable_attention_slicing(slice_size="auto")
            print("✅ Attention Slicing 활성화 (xFormers 대체)")
        except Exception:
            pass

    # 2. VAE Tiling (고해상도/메모리 부족 시 안정성) - 필수!
    try:
        pipe.enable_vae_tiling()
        print("✅ VAE Tiling 활성화 (메모리 절약)")
    except Exception as e:
        print(f"⚠️  VAE Tiling 활성화 실패: {e}")
    
    # 3. VAE Slicing (추가 메모리 절약)
    try:
        pipe.enable_vae_slicing()
        print("✅ VAE Slicing 활성화 (추가 메모리 절약)")
    except Exception as e:
        print(f"⚠️  VAE Slicing 활성화 실패: {e}")

    # 디바이스 이동
    if DEVICE == "cuda" and torch.cuda.is_available():
        pipe = pipe.to("cuda")
        print(f"✅ CUDA 디바이스로 이동: {torch.cuda.get_device_name(0)}")
        print(f"💾 사용 가능 VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
    else:
        pipe = pipe.to("cpu")
        print("⚠️  CPU 모드로 실행 (느림)")

    _PIPELINE = pipe
    _PIPELINE_LOADED = True # 파이프라인 로드 완료
    _CURRENT_MODEL_ID = MODEL_ID
    print("✅ 파이프라인 준비 완료")
    return _PIPELINE

def switch_model(model_id: str):
    """
    다른 모델로 전환 (커스텀 체크포인트 모델 포함)
    
    Args:
        model_id: 모델 ID (예: "sdxl_base", "cyberrealisticpony_v150", "dwkorean_doll_likeliness_v1")
    """
    global _PIPELINE, _PIPELINE_LOADED, _CURRENT_MODEL_ID
    
    print(f"🔍 switch_model 호출: model_id={model_id}, 현재 모델={_CURRENT_MODEL_ID}")
    
    # 같은 모델이면 전환 불필요
    if _CURRENT_MODEL_ID == model_id and _PIPELINE is not None:
        print(f"ℹ️  같은 모델이므로 전환하지 않습니다: {model_id}")
        return
    
    from app.diffusers.core.models import get_model_info
    from pathlib import Path
    
    model_info = get_model_info(model_id)
    if not model_info:
        raise ValueError(f"모델을 찾을 수 없습니다: {model_id}")
    
    print(f"🔄 모델 전환 중: {model_info['name']} ({model_id})")
    
    # 기존 파이프라인 메모리 해제
    if _PIPELINE is not None:
        del _PIPELINE
        import gc
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
    
    _PIPELINE = None
    _PIPELINE_LOADED = False
    
    # 커스텀 체크포인트 모델 로드
    if model_info["type"] == "checkpoint" or model_info["type"] in ["cyber_realistic", "korean_doll"]:
        _load_checkpoint_model(model_info)
    else:
        # 기본 모델 로드 (기존 로직)
        get_pipeline()
    
    _CURRENT_MODEL_ID = model_id
    print(f"✅ 모델 전환 완료: {model_info['name']}")

def _load_checkpoint_model(model_info: dict):
    """
    커스텀 체크포인트 모델(.safetensors) 로드
    
    Args:
        model_info: 모델 정보 딕셔너리
    """
    global _PIPELINE, _PIPELINE_LOADED
    
    from pathlib import Path
    from app.diffusers.core.config import LOCAL_MODEL_DIR
    
    model_dir = Path(LOCAL_MODEL_DIR)
    checkpoint_file = model_dir / model_info["file"]
    
    if not checkpoint_file.exists():
        raise FileNotFoundError(f"체크포인트 파일을 찾을 수 없습니다: {checkpoint_file}")
    
    print(f"📦 커스텀 체크포인트 로드 중: {model_info['file']}")
    
    # 기본 모델의 컴포넌트 로드 (text_encoder, vae 등)
    base_model_path = model_dir
    dtype = _torch_dtype()
    
    # 1. Text Encoders, Tokenizers (기본 모델 재사용)
    print("  [1/3] Text Encoders 로드 중 (기본 모델 재사용)...")
    text_encoder = CLIPTextModel.from_pretrained(
        str(base_model_path),
        subfolder="text_encoder",
        torch_dtype=dtype,
        local_files_only=True,
    )
    text_encoder_2 = CLIPTextModelWithProjection.from_pretrained(
        str(base_model_path),
        subfolder="text_encoder_2",
        torch_dtype=dtype,
        local_files_only=True,
    )
    tokenizer = CLIPTokenizer.from_pretrained(
        str(base_model_path),
        subfolder="tokenizer",
        local_files_only=True,
    )
    tokenizer_2 = CLIPTokenizer.from_pretrained(
        str(base_model_path),
        subfolder="tokenizer_2",
        local_files_only=True,
    )
    
    # 2. VAE (기본 모델 재사용)
    print("  [2/3] VAE 로드 중 (기본 모델 재사용)...")
    vae = AutoencoderKL.from_pretrained(
        str(base_model_path),
        subfolder="vae",
        torch_dtype=dtype,
        local_files_only=True,
    )
    
    # 3. UNet (체크포인트 파일에서 로드)
    print("  [3/3] UNet 로드 중 (체크포인트에서)...")
    # 기본 UNet 구조 로드
    unet = UNet2DConditionModel.from_pretrained(
        str(base_model_path),
        subfolder="unet",
        torch_dtype=dtype,
        local_files_only=True,
    )
    
    # 체크포인트 파일에서 UNet 가중치 로드
    from safetensors import safe_open
    
    # UNet 모델의 전체 키 확인
    unet_model_keys = set(unet.state_dict().keys())
    total_unet_keys = len(unet_model_keys)
    print(f"  🔍 UNet 모델 전체 키 개수: {total_unet_keys}개")
    
    # 체크포인트 파일에서 UNet 가중치 로드
    unet_state_dict = {}
    checkpoint_all_keys = []
    with safe_open(str(checkpoint_file), framework="pt", device="cpu") as f:
        for key in f.keys():
            checkpoint_all_keys.append(key)
            # UNet 키만 추출
            if key.startswith("model.diffusion_model."):
                unet_key = key.replace("model.diffusion_model.", "")
                unet_state_dict[unet_key] = f.get_tensor(key)
            elif key.startswith("diffusion_model."):
                unet_key = key.replace("diffusion_model.", "")
                unet_state_dict[unet_key] = f.get_tensor(key)
            elif not any(key.startswith(prefix) for prefix in ["first_stage_model.", "cond_stage_model.", "text_encoder", "vae"]):
                # 다른 컴포넌트가 아닌 키는 UNet으로 간주
                unet_state_dict[key] = f.get_tensor(key)
    
    print(f"  🔍 체크포인트 파일 전체 키 개수: {len(checkpoint_all_keys)}개")
    print(f"  🔍 체크포인트에서 추출한 UNet 키 개수: {len(unet_state_dict)}개")
    
    # 체크포인트 키 접두사 분석
    key_prefixes = {}
    model_keys_sample = []
    for key in checkpoint_all_keys:
        prefix = key.split('.')[0] if '.' in key else key
        if prefix not in key_prefixes:
            key_prefixes[prefix] = 0
        key_prefixes[prefix] += 1
        
        # model. 접두사 키 샘플 수집
        if key.startswith("model.") and len(model_keys_sample) < 10:
            model_keys_sample.append(key)
    
    print(f"  🔍 체크포인트 키 접두사 분류:")
    for prefix, count in sorted(key_prefixes.items()):
        print(f"      {prefix}: {count}개")
    
    if model_keys_sample:
        print(f"  🔍 model. 접두사 키 샘플 (처음 10개):")
        for key in model_keys_sample:
            print(f"      - {key}")
    
    # UNet 가중치 로드
    missing_keys, unexpected_keys = unet.load_state_dict(unet_state_dict, strict=False)
    
    # 매칭 통계
    matched_count = total_unet_keys - len(missing_keys)
    match_rate = (matched_count / total_unet_keys * 100) if total_unet_keys > 0 else 0
    
    print(f"  📊 UNet 키 매칭 통계:")
    print(f"      전체 키: {total_unet_keys}개")
    print(f"      매칭된 키: {matched_count}개 ({match_rate:.1f}%)")
    print(f"      누락된 키: {len(missing_keys)}개 ({100-match_rate:.1f}%)")
    print(f"      예상치 못한 키: {len(unexpected_keys)}개")
    
    if missing_keys:
        if len(missing_keys) > 20:
            print(f"  ⚠️  UNet 누락된 키 샘플 (처음 10개):")
            for key in list(missing_keys)[:10]:
                print(f"      - {key}")
        else:
            print(f"  ⚠️  UNet 누락된 키:")
            for key in missing_keys:
                print(f"      - {key}")
    
    if unexpected_keys and len(unexpected_keys) <= 20:
        print(f"  ⚠️  UNet 예상치 못한 키:")
        for key in list(unexpected_keys)[:10]:
            print(f"      - {key}")
    
    # 매칭률이 너무 낮으면 경고
    if match_rate < 50:
        print(f"  ⚠️  경고: UNet 키 매칭률이 낮습니다 ({match_rate:.1f}%). 모델이 제대로 작동하지 않을 수 있습니다.")
    elif match_rate < 90:
        print(f"  ⚠️  주의: UNet 키 매칭률이 중간 수준입니다 ({match_rate:.1f}%). 일부 기능이 제한될 수 있습니다.")
    else:
        print(f"  ✅ UNet 키 매칭률이 양호합니다 ({match_rate:.1f}%)")
    
    print("  ✅ UNet 로드 완료")
    
    # 4. Scheduler
    print("  [4/4] Scheduler 로드 중...")
    if SCHEDULER_TYPE == "dpm++" and USE_KARRAS:
        scheduler = DPMSolverMultistepScheduler.from_pretrained(
            str(base_model_path),
            subfolder="scheduler",
            local_files_only=True,
        )
        scheduler = DPMSolverMultistepScheduler.from_config(
            scheduler.config,
            use_karras=True,
        )
    else:
        scheduler = EulerDiscreteScheduler.from_pretrained(
            str(base_model_path),
            subfolder="scheduler",
            local_files_only=True,
        )
    
    # 파이프라인 구성
    print("🔧 파이프라인 구성 중...")
    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )
    
    # 최적화 옵션 적용
    try:
        pipe.enable_xformers_memory_efficient_attention()
        print("✅ xFormers 메모리 최적화 활성화")
    except Exception as e:
        print(f"⚠️  xFormers 활성화 실패: {e}")
        try:
            pipe.enable_attention_slicing(slice_size="auto")
            print("✅ Attention Slicing 활성화 (xFormers 대체)")
        except Exception:
            pass
    
    try:
        pipe.enable_vae_tiling()
        print("✅ VAE Tiling 활성화")
    except Exception as e:
        print(f"⚠️  VAE Tiling 활성화 실패: {e}")
    
    try:
        pipe.enable_vae_slicing()
        print("✅ VAE Slicing 활성화")
    except Exception as e:
        print(f"⚠️  VAE Slicing 활성화 실패: {e}")
    
    # 디바이스 이동
    if DEVICE == "cuda" and torch.cuda.is_available():
        pipe = pipe.to("cuda")
        print(f"✅ CUDA 디바이스로 이동")
    else:
        pipe = pipe.to("cpu")
        print("⚠️  CPU 모드로 실행")
    
    _PIPELINE = pipe
    _PIPELINE_LOADED = True
    print(f"✅ 커스텀 체크포인트 모델 로드 완료: {model_info['name']}")

def get_refiner_pipeline():
    """
    SDXL Refiner 파이프라인 로드 (메모리 효율적)
    필요할 때만 로드하고, CPU offload 사용
    """
    global _REFINER_PIPELINE, _REFINER_LOADED
    
    if _REFINER_PIPELINE is not None and _REFINER_LOADED:
        return _REFINER_PIPELINE
    
    if not USE_REFINER:
        return None
    
    print("🔄 Refiner 파이프라인 로딩 중...")
    dtype = _torch_dtype()
    
    from pathlib import Path
    model_path = Path(MODEL_ID)
    is_local = model_path.exists() and (model_path / "model_index.json").exists()
    
    # Refiner 모델 경로 확인 (로컬만 사용)
    if is_local:
        # 로컬 refiner 파일 확인
        refiner_file = model_path / "sd_xl_refiner_1.0.safetensors"
        if refiner_file.exists():
            print("  📁 로컬 Refiner 파일 감지: sd_xl_refiner_1.0.safetensors")
            # 로컬 refiner를 로드하려면 표준 diffusers 형식이 필요
            # 일단 로컬 모델 경로에서 로드 시도
            refiner_model_id = str(model_path)
            local_files_only = True
        else:
            raise FileNotFoundError(
                f"로컬 Refiner 파일을 찾을 수 없습니다: {model_path}/sd_xl_refiner_1.0.safetensors\n"
                "로컬 모델만 사용하도록 설정되어 있습니다."
            )
    else:
        raise ValueError("로컬 모델만 사용하도록 설정되어 있습니다. 로컬 모델 경로가 필요합니다.")
    
    # Refiner 파이프라인 로드 (Img2Img 파이프라인 사용, 로컬만)
    try:
        # 로컬 모델에서 Refiner 로드 시도
        # Refiner는 Img2Img 파이프라인으로 로드되지만, 로컬에 refiner 폴더가 없으면
        # base 모델의 컴포넌트를 재사용하고 refiner 가중치만 로드
        print("  🔄 로컬 Refiner 로드 중...")
        
        # 방법 1: 표준 diffusers 형식 refiner 폴더가 있는지 확인
        refiner_folder = model_path / "refiner"
        if refiner_folder.exists() and (refiner_folder / "model_index.json").exists():
            refiner = StableDiffusionXLImg2ImgPipeline.from_pretrained(
                str(refiner_folder),
                torch_dtype=dtype,
                local_files_only=True,
            )
            print("  ✅ 표준 diffusers 형식 Refiner 로드 완료")
        # 방법 1-2: model_path에 refiner 서브폴더가 있는지 확인 (unet, vae 등)
        elif (model_path / "unet").exists() and refiner_file.exists():
            # Refiner는 Base와 동일한 구조를 사용하지만, Refiner safetensors 파일의 가중치를 사용
            # 이 경우 Refiner UNet을 별도로 로드해야 함
            print("  🔄 Refiner UNet을 별도로 로드 중...")
            
            # Base 파이프라인 가져오기
            base_pipe = get_pipeline()
            
            # Refiner UNet을 Base UNet과 동일한 구조로 생성 (하지만 Refiner 가중치 사용)
            from diffusers import UNet2DConditionModel
            refiner_unet = UNet2DConditionModel.from_pretrained(
                str(model_path),
                subfolder="unet",
                torch_dtype=dtype,
                local_files_only=True,
            )
            
            # Refiner safetensors 파일에서 UNet 가중치 로드
            # SDXL Refiner safetensors는 일반적으로 직접 UNet 키를 사용 (접두사 없음)
            from safetensors import safe_open
            refiner_unet_state_dict = {}
            file_keys = []
            with safe_open(str(refiner_file), framework="pt", device="cpu") as f:
                for key in f.keys():
                    file_keys.append(key)
                    # UNet 키만 추출 (Text Encoder, VAE 제외)
                    # conditioner.*는 Text Encoder 키이므로 제외
                    if not any(key.startswith(prefix) for prefix in [
                        "first_stage_model.", "cond_stage_model.", 
                        "text_encoder", "vae", "conditioner"
                    ]):
                        # UNet 키로 간주
                        refiner_unet_state_dict[key] = f.get_tensor(key)
            
            # UNet 키가 없으면 파일 구조 확인
            if not refiner_unet_state_dict:
                print("  ⚠️  Refiner safetensors 파일에 UNet 키가 없습니다.")
                print("  ℹ️  이 파일은 Text Encoder만 포함하거나 다른 형식일 수 있습니다.")
                print("  ℹ️  Refiner는 Base UNet 가중치를 사용합니다.")
            
            # 디버깅: 파일의 키 구조 확인
            print(f"  🔍 Refiner 파일 키 샘플 (처음 10개):")
            for key in file_keys[:10]:
                print(f"      - {key}")
            print(f"  🔍 UNet 모델 키 샘플 (처음 10개):")
            for key in list(refiner_unet.state_dict().keys())[:10]:
                print(f"      - {key}")
            
            # UNet 모델 키와 파일 키 매칭
            refiner_unet_model_keys = set(refiner_unet.state_dict().keys())
            matched_state_dict = {}
            matched_count = 0
            
            # 1. 직접 매칭 시도
            for model_key in refiner_unet_model_keys:
                if model_key in refiner_unet_state_dict:
                    matched_state_dict[model_key] = refiner_unet_state_dict[model_key]
                    matched_count += 1
                # 2. ComfyUI 형식 변환 시도 (model.diffusion_model. -> )
                elif f"model.diffusion_model.{model_key}" in refiner_unet_state_dict:
                    matched_state_dict[model_key] = refiner_unet_state_dict[f"model.diffusion_model.{model_key}"]
                    matched_count += 1
                # 3. diffusion_model. 접두사 제거 시도
                elif f"diffusion_model.{model_key}" in refiner_unet_state_dict:
                    matched_state_dict[model_key] = refiner_unet_state_dict[f"diffusion_model.{model_key}"]
                    matched_count += 1
                # 4. model. 접두사 추가 시도
                elif f"model.{model_key}" in refiner_unet_state_dict:
                    matched_state_dict[model_key] = refiner_unet_state_dict[f"model.{model_key}"]
                    matched_count += 1
                # 5. unet. 접두사 추가 시도
                elif f"unet.{model_key}" in refiner_unet_state_dict:
                    matched_state_dict[model_key] = refiner_unet_state_dict[f"unet.{model_key}"]
                    matched_count += 1
            
            print(f"  📊 Refiner UNet 키 매칭: {matched_count}/{len(refiner_unet_model_keys)}개")
            
            # UNet 가중치 로드
            if matched_state_dict:
                missing_keys, unexpected_keys = refiner_unet.load_state_dict(matched_state_dict, strict=False)
                if len(missing_keys) > 100:
                    print(f"  ⚠️  Refiner UNet 누락된 키: {len(missing_keys)}개 (일부는 정상일 수 있음)")
                    print(f"      샘플: {list(missing_keys)[:5]}")
                elif missing_keys:
                    print(f"  ⚠️  Refiner UNet 누락된 키: {len(missing_keys)}개")
                if unexpected_keys:
                    print(f"  ⚠️  Refiner UNet 예상치 못한 키: {len(unexpected_keys)}개")
                print("  ✅ Refiner UNet 가중치 로드 완료")
            else:
                print("  ⚠️  Refiner UNet 가중치를 찾을 수 없습니다. 기본 가중치 사용")
            
            # Img2Img 파이프라인 생성 (base 컴포넌트 재사용, refiner UNet 사용)
            refiner = StableDiffusionXLImg2ImgPipeline(
                vae=base_pipe.vae,
                text_encoder=base_pipe.text_encoder,
                text_encoder_2=base_pipe.text_encoder_2,
                tokenizer=base_pipe.tokenizer,
                tokenizer_2=base_pipe.tokenizer_2,
                unet=refiner_unet,  # Refiner UNet 사용
                scheduler=base_pipe.scheduler,
            )
            refiner = refiner.to(dtype=dtype)
            print("  ✅ Refiner 파이프라인 생성 완료")
        else:
            # 방법 2: base 모델 컴포넌트 재사용 + refiner safetensors 파일에서 가중치 로드
            print("  📦 base 모델 컴포넌트 재사용 + refiner 가중치 로드...")
            
            # base 파이프라인 가져오기 (이미 로드되어 있어야 함)
            base_pipe = get_pipeline()
            
            # Refiner UNet을 base UNet과 동일한 구조로 생성
            from diffusers import UNet2DConditionModel
            refiner_unet = UNet2DConditionModel.from_pretrained(
                str(model_path),
                subfolder="unet",
                torch_dtype=dtype,
                local_files_only=True,
            )
            
            # Refiner safetensors 파일에서 UNet 가중치 로드
            # UNet 모델의 키 구조 확인
            refiner_unet_model_keys = set(refiner_unet.state_dict().keys())
            
            # safetensors 파일에서 모든 키 로드
            from safetensors import safe_open
            file_state_dict = {}
            file_keys = []
            with safe_open(str(refiner_file), framework="pt", device="cpu") as f:
                for key in f.keys():
                    file_state_dict[key] = f.get_tensor(key)
                    file_keys.append(key)
            
            # 디버깅: 파일의 키 구조 확인 (반드시 출력)
            print(f"  🔍 Refiner 파일 키 샘플 (처음 20개):")
            for i, key in enumerate(file_keys[:20], 1):
                print(f"      {i:2d}. {key}")
            print(f"  🔍 UNet 모델 키 샘플 (처음 20개):")
            for i, key in enumerate(list(refiner_unet_model_keys)[:20], 1):
                print(f"      {i:2d}. {key}")
            
            # 파일 키 접두사 분석
            file_key_prefixes = {}
            for key in file_keys:
                prefix = key.split('.')[0] if '.' in key else key
                if prefix not in file_key_prefixes:
                    file_key_prefixes[prefix] = 0
                file_key_prefixes[prefix] += 1
            print(f"  🔍 파일 키 접두사 분류:")
            for prefix, count in sorted(file_key_prefixes.items()):
                print(f"      {prefix}: {count}개")
            
            # UNet 모델 키와 파일 키 매칭
            refiner_unet_state_dict = {}
            matched_count = 0
            matched_patterns = {"direct": 0, "model.diffusion_model": 0, "diffusion_model": 0, "model": 0, "unet": 0}
            
            # 1. 직접 매칭 시도
            for model_key in refiner_unet_model_keys:
                if model_key in file_state_dict:
                    refiner_unet_state_dict[model_key] = file_state_dict[model_key]
                    matched_count += 1
                    matched_patterns["direct"] += 1
                # 2. ComfyUI 형식 변환 시도 (model.diffusion_model. -> )
                elif f"model.diffusion_model.{model_key}" in file_state_dict:
                    refiner_unet_state_dict[model_key] = file_state_dict[f"model.diffusion_model.{model_key}"]
                    matched_count += 1
                    matched_patterns["model.diffusion_model"] += 1
                # 3. diffusion_model. 접두사 제거 시도
                elif f"diffusion_model.{model_key}" in file_state_dict:
                    refiner_unet_state_dict[model_key] = file_state_dict[f"diffusion_model.{model_key}"]
                    matched_count += 1
                    matched_patterns["diffusion_model"] += 1
                # 4. model. 접두사 추가 시도 (일부 형식)
                elif f"model.{model_key}" in file_state_dict:
                    refiner_unet_state_dict[model_key] = file_state_dict[f"model.{model_key}"]
                    matched_count += 1
                    matched_patterns["model"] += 1
                # 5. unet. 접두사 추가 시도
                elif f"unet.{model_key}" in file_state_dict:
                    refiner_unet_state_dict[model_key] = file_state_dict[f"unet.{model_key}"]
                    matched_count += 1
                    matched_patterns["unet"] += 1
            
            print(f"  📊 Refiner UNet 키 매칭: {matched_count}/{len(refiner_unet_model_keys)}개")
            if matched_count > 0:
                print(f"  📊 매칭 패턴:")
                for pattern, count in matched_patterns.items():
                    if count > 0:
                        print(f"      {pattern}: {count}개")
            
            # UNet 가중치 로드
            if refiner_unet_state_dict:
                missing_keys, unexpected_keys = refiner_unet.load_state_dict(refiner_unet_state_dict, strict=False)
                if len(missing_keys) > 100:  # 너무 많으면 일부만 출력
                    print(f"  ⚠️  Refiner UNet 누락된 키: {len(missing_keys)}개 (일부는 정상일 수 있음)")
                    print(f"      샘플: {list(missing_keys)[:5]}")
                elif missing_keys:
                    print(f"  ⚠️  Refiner UNet 누락된 키: {len(missing_keys)}개")
                if unexpected_keys:
                    print(f"  ⚠️  Refiner UNet 예상치 못한 키: {len(unexpected_keys)}개")
                print("  ✅ Refiner UNet 가중치 로드 완료")
            else:
                print("  ⚠️  Refiner UNet 가중치를 찾을 수 없습니다. 기본 가중치 사용")
            
            # Img2Img 파이프라인 생성 (base 컴포넌트 재사용, refiner UNet 사용)
            refiner = StableDiffusionXLImg2ImgPipeline(
                vae=base_pipe.vae,
                text_encoder=base_pipe.text_encoder,
                text_encoder_2=base_pipe.text_encoder_2,
                tokenizer=base_pipe.tokenizer,
                tokenizer_2=base_pipe.tokenizer_2,
                unet=refiner_unet,  # Refiner UNet 사용
                scheduler=base_pipe.scheduler,
            )
            refiner = refiner.to(dtype=dtype)
        
        # Karras 스케줄러 적용 (로컬 모델에서)
        if SCHEDULER_TYPE == "dpm++" and USE_KARRAS:
            print("  🔥 Refiner에 Karras 스케줄러 적용 중...")
            if isinstance(refiner.scheduler, DPMSolverMultistepScheduler):
                refiner.scheduler = DPMSolverMultistepScheduler.from_config(
                    refiner.scheduler.config,
                    use_karras=True,
                )
                print("  ✅ Refiner DPM++ Multistep Scheduler (Karras) 적용 완료")
            else:
                # 스케줄러 교체
                refiner.scheduler = DPMSolverMultistepScheduler.from_config(
                    base_pipe.scheduler.config if 'base_pipe' in locals() else refiner.scheduler.config,
                    use_karras=True,
                )
                print("  ✅ Refiner DPM++ Multistep Scheduler (Karras) 적용 완료")
        
        # 메모리 최적화 옵션
        try:
            refiner.enable_xformers_memory_efficient_attention()
            print("✅ Refiner: xFormers 메모리 최적화 활성화")
        except Exception:
            refiner.enable_attention_slicing(slice_size="auto")
            print("✅ Refiner: Attention Slicing 활성화")
        
        refiner.enable_vae_tiling()
        refiner.enable_vae_slicing()
        
        # CPU offload로 메모리 절약 (8GB VRAM 최적화)
        refiner.enable_model_cpu_offload()
        print("✅ Refiner: CPU Offload 활성화 (메모리 절약)")
        
        _REFINER_PIPELINE = refiner
        _REFINER_LOADED = True
        print("✅ Refiner 파이프라인 준비 완료")
        return _REFINER_PIPELINE
        
    except Exception as e:
        print(f"❌ Refiner 파이프라인 로드 실패: {e}")
        print("  ⚠️  Refiner 없이 계속 진행합니다.")
        return None
