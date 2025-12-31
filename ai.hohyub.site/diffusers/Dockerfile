FROM python:3.11-slim

WORKDIR /app

# Disable Python output buffering
ENV PYTHONUNBUFFERED=1

# Install system dependencies for PyTorch, CUDA, and image processing
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
    libgomp1 \
    git \
    curl || \
    (sleep 2 && apt-get update && apt-get install -y --fix-missing --no-install-recommends \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    git \
    curl)) && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
# build context가 ./ai.hohyub.site/diffusers이므로 루트의 requirements.txt 사용
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# PyTorch with CUDA support (RTX 4060 최적화)
# PyTorch 2.5.1 + CUDA 12.1
RUN pip install --no-cache-dir \
    torch==2.5.1+cu121 \
    torchvision==0.20.1+cu121 \
    torchaudio==2.5.1+cu121 \
    --index-url https://download.pytorch.org/whl/cu121

# xFormers for memory optimization (RTX 4060 최적화)
RUN pip install --no-cache-dir xformers

# Copy application code
COPY app/ ./app/

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV PORT=8001
ENV DEVICE=cuda
ENV DTYPE=float16
ENV DEFAULT_WIDTH=1024
ENV DEFAULT_HEIGHT=1024
ENV DEFAULT_STEPS=25
ENV DEFAULT_GUIDANCE=7.0
ENV MAX_WIDTH=1024
ENV MAX_HEIGHT=1024
ENV MAX_STEPS=50
ENV MAX_CONCURRENCY=1
ENV USE_REFINER=true
ENV DEFAULT_REFINER_STRENGTH=0.3

# Expose API port
EXPOSE 8001

# Run the API server
CMD ["python", "-u", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

