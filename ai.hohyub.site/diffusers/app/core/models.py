"""
로컬 모델 목록 관리 및 감지
"""
from pathlib import Path
from typing import List, Dict, Optional
from app.diffusers.core.config import LOCAL_MODEL_DIR

def detect_available_models() -> List[Dict[str, str]]:
    """
    로컬 모델 디렉토리에서 사용 가능한 모델 목록 감지
    
    Returns:
        List[Dict]: 모델 정보 리스트
        [
            {
                "id": "sdxl_base",
                "name": "SDXL Base",
                "type": "base",  # base, checkpoint
                "path": str,
                "file": str
            },
            ...
        ]
    """
    models = []
    model_dir = Path(LOCAL_MODEL_DIR)
    
    if not model_dir.exists():
        return models
    
    # 1. 기본 SDXL 모델 (표준 diffusers 형식)
    if (model_dir / "model_index.json").exists():
        models.append({
            "id": "sdxl_base",
            "name": "SDXL Base (기본)",
            "type": "base",
            "path": str(model_dir),
            "file": None,
            "description": "표준 SDXL 베이스 모델"
        })
    
    # 2. 커스텀 체크포인트 모델 감지 (.safetensors 파일)
    for safetensor_file in model_dir.glob("*.safetensors"):
        filename = safetensor_file.name
        
        # 기본 모델 파일은 제외
        if filename in ["sd_xl_base_1.0.safetensors", "sd_xl_refiner_1.0.safetensors", "sdxl.vae.safetensors"]:
            continue
        
        # 모델 이름 추출 (파일명에서 확장자 제거)
        model_name = filename.replace(".safetensors", "")
        
        # 모델 타입 및 설명 결정
        model_type = "checkpoint"
        description = "커스텀 체크포인트 모델"
        
        if "cyberrealistic" in model_name.lower() or "cyber" in model_name.lower():
            model_type = "cyber_realistic"
            description = "사이버 리얼리스틱 스타일 모델"
        elif "korean" in model_name.lower() or "doll" in model_name.lower():
            model_type = "korean_doll"
            description = "한국형 인형 스타일 모델"
        
        # 모델 ID 생성: 파일명을 소문자로 변환하고 공백/하이픈을 언더스코어로 변경
        # 예: "CyberrealisticPony_v150" -> "cyberrealisticpony_v150"
        model_id = model_name.lower().replace(" ", "_").replace("-", "_")
        
        models.append({
            "id": model_id,
            "name": model_name.replace("_", " ").title(),
            "type": model_type,
            "path": str(model_dir),
            "file": filename,
            "description": description,
            "size_gb": round(safetensor_file.stat().st_size / (1024**3), 2)
        })
        
        print(f"📦 모델 감지: {filename} -> ID: {model_id}")
    
    return models

def get_model_info(model_id: str) -> Optional[Dict[str, str]]:
    """
    특정 모델 ID의 정보 반환
    
    Args:
        model_id: 모델 ID
        
    Returns:
        Dict: 모델 정보 또는 None
    """
    models = detect_available_models()
    for model in models:
        if model["id"] == model_id:
            return model
    return None

