FROM python:3.11-slim

WORKDIR /app

# Disable Python output buffering
ENV PYTHONUNBUFFERED=1

# Install system dependencies for YOLO and image processing
# libelf1t64 패키지 문제를 우회하기 위해 --fix-missing과 재시도 로직 사용
RUN apt-get update && \
    (apt-get install -y --fix-missing --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 || \
    (sleep 2 && apt-get update && apt-get install -y --fix-missing --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1)) && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
# build context가 ./ai.hohyub.site/yolo이므로 상위 폴더의 requirements.txt 사용
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
# build context가 ./ai.hohyub.site/yolo이므로 app/ 폴더 복사
COPY app/ ./app/

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV PORT=8002

# Expose API port
EXPOSE 8002

# Run the API server
# volumes로 yolo/app이 /app에 마운트되므로 yolo_api:app 사용
CMD ["python", "-u", "-m", "uvicorn", "yolo_api:app", "--host", "0.0.0.0", "--port", "8002"]

