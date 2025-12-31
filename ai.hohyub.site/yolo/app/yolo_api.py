"""YOLO FastAPI 서버
이미지 업로드를 받아 YOLO 분석을 수행하는 API 서버
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import sys
import tempfile
from pathlib import Path

# 현재 디렉토리를 경로에 추가
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

from yolo_detection import process_image_file
from yolo_class import classify_image
from yolo_segment import segment_image
from yolo_pose import estimate_pose

app = FastAPI(title="YOLO Image Analysis API", version="1.0.0")

# CORS 설정
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5000,http://127.0.0.1:3000,http://127.0.0.1:5000"
)
if allowed_origins_str == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "YOLO Image Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "detect": "POST /detect - Object detection",
            "classify": "POST /classify - Image classification",
            "segment": "POST /segment - Image segmentation",
            "pose": "POST /pose - Pose estimation",
            "health": "GET /health - Health check",
        },
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "yolo"}


@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    detect_all_objects: bool = Form(True)
):
    """YOLO 객체 검출"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # YOLO Detection 실행
        result = process_image_file(
            tmp_path,
            save_to_save_dir=True,
            detect_all_objects=detect_all_objects
        )
        
        # 임시 파일 삭제
        os.unlink(tmp_path)
        
        return {
            "status": "success",
            "task": "detection",
            "result": str(result) if result else "Detection completed"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "task": "detection"}
        )


@app.post("/classify")
async def classify_image_endpoint(file: UploadFile = File(...)):
    """YOLO 이미지 분류"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # YOLO Classification 실행
        result = classify_image(tmp_path)
        
        # 임시 파일 삭제
        os.unlink(tmp_path)
        
        return {
            "status": "success",
            "task": "classification",
            "result": str(result) if result else "Classification completed"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "task": "classification"}
        )


@app.post("/segment")
async def segment_image_endpoint(file: UploadFile = File(...)):
    """YOLO 이미지 세그멘테이션"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # YOLO Segmentation 실행
        result = segment_image(tmp_path)
        
        # 임시 파일 삭제
        os.unlink(tmp_path)
        
        return {
            "status": "success",
            "task": "segmentation",
            "result": str(result) if result else "Segmentation completed"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "task": "segmentation"}
        )


@app.post("/pose")
async def estimate_pose_endpoint(file: UploadFile = File(...)):
    """YOLO 포즈 추정"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # YOLO Pose 추정 실행
        result = estimate_pose(tmp_path)
        
        # 임시 파일 삭제
        os.unlink(tmp_path)
        
        return {
            "status": "success",
            "task": "pose",
            "result": str(result) if result else "Pose estimation completed"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "task": "pose"}
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)

