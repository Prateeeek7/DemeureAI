# Single image: builds the React app, then serves it and the API from FastAPI.

# --- 1. Frontend build ------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.js postcss.config.js eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- 2. Python runtime ------------------------------------------------------------
FROM python:3.10-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    DATA_DIR=/data \
    FRONTEND_DIST=/app/dist \
    HF_HOME=/opt/hf-cache

WORKDIR /app/backend
COPY backend/requirements.txt ./
# CPU-only torch keeps the image ~2 GB smaller than the default CUDA build.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
 && pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so containers start without network access.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY backend/ ./
COPY --from=web /app/dist /app/dist

RUN useradd --system --uid 10001 demeure \
 && mkdir -p /data && chown -R demeure /data /opt/hf-cache
USER demeure
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
