# ============================================================
# Stage 1: Download LFM2.5 GGUF
# ============================================================

FROM python:3.11-slim-bookworm AS model-downloader

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir huggingface_hub

RUN mkdir -p /models

RUN python3 -c "\
from huggingface_hub import hf_hub_download; \
repo='LiquidAI/LFM2.5-VL-3B-GGUF'; \
hf_hub_download( \
    repo_id=repo, \
    filename='LFM2.5-VL-3B-Q4_0.gguf', \
    local_dir='/models' \
); \
hf_hub_download( \
    repo_id=repo, \
    filename='mmproj-LFM2.5-VL-3B-BF16.gguf', \
    local_dir='/models' \
)"


# ============================================================
# Stage 2: Original DSH + llama.cpp
# ============================================================

FROM ghcr.io/ggml-org/llama.cpp:full

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    DSH_HOME=/data \
    DSH_INTERNAL_PORT=3080

# ============================================================
# System packages
# ============================================================

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        nginx \
        apache2-utils \
        procps \
        tzdata \
        build-essential \
        python3 \
        make \
        g++ \
        pkg-config \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default


# ============================================================
# Node.js 22
# ============================================================

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && node --version \
    && npm --version \
    && rm -rf /var/lib/apt/lists/*


# ============================================================
# Verify llama.cpp
# ============================================================

RUN /app/llama-server --version


# ============================================================
# Copy GGUF models
# ============================================================

COPY --from=model-downloader /models /app/

RUN echo "===== MODELS =====" \
    && ls -lh /app/*.gguf


# ============================================================
# DeepSeek Harness
# ============================================================

RUN npm install -g @deepseek-ai/dsh@latest \
    && dsh --version


# ============================================================
# DSH patches
# ============================================================

COPY patch-dsh.mjs /patch-dsh.mjs
RUN chmod +x /patch-dsh.mjs

COPY probe-sessions.mjs /probe-sessions.mjs
RUN chmod +x /probe-sessions.mjs

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh


# ============================================================
# Model configuration
# ============================================================



WORKDIR /workspace

EXPOSE 7860

ENTRYPOINT ["/entrypoint.sh"]
