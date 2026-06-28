FROM python:3.11-slim

WORKDIR /app

# System deps for any compiled packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install CPU-only torch first (smaller image, ~800 MB vs ~2.5 GB for CUDA)
RUN pip install --no-cache-dir torch==2.2.2+cpu --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
