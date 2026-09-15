
FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# ============================================================
# System packages
# ============================================================

RUN apt-get update && \
    apt-get install -y \
        git \
        curl \
        ca-certificates \
        nginx \
        && \
    rm -rf /var/lib/apt/lists/*

# ============================================================
# pnpm
# ============================================================

RUN corepack enable && \
    corepack prepare pnpm@11.7.0 --activate



# ============================================================
# Clone YOUR fork at release 1.0
# ============================================================

WORKDIR /app

RUN git clone \
        --branch 1.0 \
        --depth 1 \
        https://github.com/innokria/deepseek-harness.git \
        deepseek-harness

WORKDIR /app/deepseek-harness

# ============================================================
# Install
# ============================================================

RUN pnpm install

# ============================================================
# Build
# ============================================================

RUN pnpm run build

# ============================================================
# Persistent HF storage
# ============================================================

ENV DSH_HOME=/data/dsh

# DSH must remain localhost for security
ENV DSH_HOST=127.0.0.1
ENV DSH_PORT=3080

# HF public port
ENV PORT=7860

RUN mkdir -p /data/dsh

# ============================================================
# Nginx
# ============================================================

COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 7860

CMD ["/start.sh"]
