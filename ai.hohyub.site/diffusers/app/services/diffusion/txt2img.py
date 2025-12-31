import math
import torch
from app.diffusers.services.diffusion.pipeline_manager import get_pipeline, get_refiner_pipeline
from app.diffusers.core.config import (
    DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_STEPS, DEFAULT_GUIDANCE,
    MAX_WIDTH, MAX_HEIGHT, MAX_STEPS, DEVICE, USE_REFINER, DEFAULT_REFINER_STRENGTH
)

def _clamp_int(v: int, lo: int, hi: int) -> int:
    """값을 최소/최대 범위로 제한"""
    return max(lo, min(hi, int(v)))

def _round_to_multiple(v: int, base: int = 8) -> int:
    """값을 base의 배수로 내림"""
    return int(math.floor(v / base) * base)

def generate_txt2img(
    prompt: str,
    negative_prompt: str | None = None,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    steps: int = DEFAULT_STEPS,
    guidance_scale: float = DEFAULT_GUIDANCE,
    seed: int | None = None,
    use_refiner: bool | None = None,
    refiner_strength: float | None = None,
):
    """
    텍스트 프롬프트로부터 이미지 생성
    
    Args:
        prompt: 생성할 이미지를 설명하는 텍스트
        negative_prompt: 제외할 요소를 설명하는 텍스트
        width: 이미지 너비 (8의 배수로 자동 조정, MAX_WIDTH로 제한)
        height: 이미지 높이 (8의 배수로 자동 조정, MAX_HEIGHT로 제한)
        steps: 샘플링 스텝 수 (MAX_STEPS로 제한)
        guidance_scale: CFG Scale (창의성 조절, SDXL 권장 5-9)
        seed: 랜덤 시드 (재현성)
    
    Returns:
        (PIL.Image, dict): 생성된 이미지와 메타데이터
    """
    pipe = get_pipeline()

    # 파라미터 보정 (OOM 방지)
    # 8GB VRAM에서는 1024x1024가 안전한 최대 해상도
    width = _round_to_multiple(_clamp_int(width, 64, MAX_WIDTH), 8)
    height = _round_to_multiple(_clamp_int(height, 64, MAX_HEIGHT), 8)
    steps = _clamp_int(steps, 1, MAX_STEPS)
    
    # 해상도 경고
    if width > 1024 or height > 1024:
        import warnings
        warnings.warn(
            f"⚠️  해상도 {width}x{height}은 8GB VRAM에서 OOM 위험이 있습니다. "
            f"1024x1024 이하를 권장합니다.",
            UserWarning
        )

    # 시드 설정
    gen = None
    if seed is not None:
        device = "cuda" if (DEVICE == "cuda" and torch.cuda.is_available()) else "cpu"
        gen = torch.Generator(device=device).manual_seed(int(seed))

    # SDXL 이미지 생성
    # guidance_scale: 5~9 권장 (기본 7.0)
    # 너무 높으면 과포화, 너무 낮으면 프롬프트 무시
    
    # Refiner 사용 여부 확인
    use_refiner_flag = use_refiner if use_refiner is not None else USE_REFINER
    refiner = get_refiner_pipeline() if use_refiner_flag else None
    
    # upcast_vae deprecation 경고 방지
    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=FutureWarning, message=".*upcast_vae.*")
        
        if refiner is not None:
            # Refiner 사용 시: Base 모델에서 Latent 출력 받기
            print("🔄 Base 모델로 Latent 생성 중...")
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=float(guidance_scale),
                generator=gen,
                output_type="latent",  # Latent space 출력 (VAE 디코딩 전)
            )
            
            # Base 모델의 Latent 출력
            latents = result.images[0]  # torch.Tensor (latent space)
            
            # Refiner로 Latent 개선 (이미지 구조와 동일)
            print("✨ Refiner로 Latent 개선 중... (디테일 향상)")
            strength = refiner_strength if refiner_strength is not None else DEFAULT_REFINER_STRENGTH
            strength = max(0.0, min(1.0, float(strength)))  # 0.0~1.0 범위로 제한
            
            refiner_gen = None
            if seed is not None:
                device = "cuda" if (DEVICE == "cuda" and torch.cuda.is_available()) else "cpu"
                refiner_gen = torch.Generator(device=device).manual_seed(int(seed) + 1)  # 시드 변경
            
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", category=FutureWarning, message=".*upcast_vae.*")
                
                # Refiner가 Latent를 받아서 개선 (이미지 구조와 일치)
                refined_result = refiner(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    image=latents,  # Base 모델의 Latent 출력 직접 전달
                    strength=strength,  # 0.25~0.3 권장 (디테일 살리면서 원본 유지)
                    num_inference_steps=max(1, int(steps * 0.5)),  # Refiner는 절반 스텝 사용
                    guidance_scale=float(guidance_scale),
                    generator=refiner_gen,
                    output_type="pil",  # 최종 이미지로 디코딩
                )
            
            image = refined_result.images[0]
            print(f"✅ Refiner 적용 완료 (strength: {strength})")
            
            # Refiner 메모리 정리
            if DEVICE == "cuda" and torch.cuda.is_available():
                torch.cuda.empty_cache()
                import gc
                gc.collect()
        else:
            # Refiner 미사용 시: Base 모델에서 직접 이미지 생성
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=float(guidance_scale),
                generator=gen,
                output_type="pil",  # PIL Image로 명시적 반환
            )
            image = result.images[0]

    # 메타데이터 생성
    meta = {
        "model_id": getattr(pipe, "name_or_path", None),
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "guidance_scale": float(guidance_scale),
        "seed": seed,
        "device": "cuda" if (DEVICE == "cuda" and torch.cuda.is_available()) else "cpu",
        "refiner_used": (use_refiner if use_refiner is not None else USE_REFINER) and get_refiner_pipeline() is not None,
        "refiner_strength": refiner_strength if (use_refiner if use_refiner is not None else USE_REFINER) else None,
    }
    return image, meta
