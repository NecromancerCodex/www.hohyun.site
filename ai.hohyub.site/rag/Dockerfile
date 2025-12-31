FROM python:3.11-slim

WORKDIR /app

# Disable Python output buffering
ENV PYTHONUNBUFFERED=1

# Install system dependencies for PyTorch, transformers, and PostgreSQL
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
# rag/requirements.txt가 공통 라이브러리
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
# build context가 ./ai.hohyub.site/rag이므로 상대 경로 사용
# .dockerignore에서 llama/app/model/ 제외됨 (S3에서 직접 사용)
COPY main.py ./
COPY openai/app/ ./openai/app/
COPY llama/app/ ./llama/app/

# 환경 변수 설정
ENV PYTHONPATH=/app:/app/openai/app:/app/llama/app
ENV PORT=8000

# Expose API port
EXPOSE 8000

# 서버 실행 (모델은 S3에서 직접 사용)
CMD ["python", "-u", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

