#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# DeepSeek Harness + llama.cpp
# CPU-only / 2 CPU cores / 16 GB RAM
# ==========================================================

PORT="${PORT:-7860}"
DSH_INTERNAL_PORT="${DSH_INTERNAL_PORT:-3080}"
DSH_HOME="${DSH_HOME:-/data}"

# ----------------------------------------------------------
# llama.cpp
# ----------------------------------------------------------

LLAMA_SERVER="${LLAMA_SERVER:-/app/llama-server}"
LLAMA_HOST="${LLAMA_HOST:-127.0.0.1}"
LLAMA_PORT="${LLAMA_PORT:-8000}"

MODEL_NAME="${MODEL_NAME:-LFM2.5}"

MODEL_PATH="${MODEL_PATH:-/app/LFM2.5-VL-3B-Q4_0.gguf}"
MMPROJ_PATH="${MMPROJ_PATH:-/app/mmproj-LFM2.5-VL-3B-BF16.gguf}"

# Optional Hugging Face fallback
HF_MODEL_REPO="${HF_MODEL_REPO:-LiquidAI/LFM2.5-VL-3B-GGUF}"
HF_MODEL_FILE="${HF_MODEL_FILE:-LFM2.5-VL-3B-Q4_0.gguf}"
HF_MMPROJ_FILE="${HF_MMPROJ_FILE:-mmproj-LFM2.5-VL-3B-BF16.gguf}"

# ----------------------------------------------------------
# CPU tuning
# ----------------------------------------------------------

LLAMA_CONTEXT="${LLAMA_CONTEXT:-22288}"
LLAMA_MAX_TOKENS="${LLAMA_MAX_TOKENS:-512}"
LLAMA_THREADS="${LLAMA_THREADS:-2}"

# IMPORTANT:
# Internal credential used by DSH/pi-ai.
export LLAMA_API_KEY="${LLAMA_API_KEY:-local}"

# ==========================================================
# Startup
# ==========================================================

echo
echo "=========================================================="
echo " DeepSeek Harness + llama.cpp"
echo "=========================================================="
echo "[DSH] Home:              ${DSH_HOME}"
echo "[DSH] Public port:      ${PORT}"
echo "[DSH] Internal port:    ${DSH_INTERNAL_PORT}"
echo
echo "[LLAMA] Server:         ${LLAMA_SERVER}"
echo "[LLAMA] Host:           ${LLAMA_HOST}"
echo "[LLAMA] Port:           ${LLAMA_PORT}"
echo "[LLAMA] Model:          ${MODEL_NAME}"
echo "[LLAMA] Model path:     ${MODEL_PATH}"
echo "[LLAMA] MMProj path:    ${MMPROJ_PATH}"
echo "[LLAMA] Context:        ${LLAMA_CONTEXT}"
echo "[LLAMA] Max tokens:     ${LLAMA_MAX_TOKENS}"
echo "[LLAMA] Threads:        ${LLAMA_THREADS}"
echo "=========================================================="

mkdir -p \
    "${DSH_HOME}" \
    /workspace \
    /var/log/nginx

# ==========================================================
# 1. Install latest DSH + pnpm
# ==========================================================

echo
echo "=========================================================="
echo "[1/7] Installing DSH + pnpm"
echo "=========================================================="

if npm install -g @deepseek-ai/dsh@latest; then
    echo "[DSH] Version:"
    dsh --version || true
else
    echo "[DSH] WARN: npm install failed"
    echo "[DSH] Using image-installed DSH"
fi

# ----------------------------------------------------------
# pnpm is required by the official DSH plugin manager
# ----------------------------------------------------------

if command -v pnpm >/dev/null 2>&1; then
    echo "[DSH] pnpm already installed:"
    pnpm --version
else
    echo "[DSH] Installing pnpm..."

    npm install -g pnpm@latest

    echo "[DSH] pnpm version:"
    pnpm --version
fi

# Verify both commands exist
command -v dsh >/dev/null 2>&1 || {
    echo "[DSH] ERROR: dsh command not found"
    exit 1
}

command -v pnpm >/dev/null 2>&1 || {
    echo "[DSH] ERROR: pnpm command not found"
    exit 1
}

# ==========================================================
# 2. Patch DSH persistence
# ==========================================================

echo
echo "=========================================================="
echo "[2/7] Applying DSH persistence patch"
echo "=========================================================="

if [[ -f /patch-dsh.mjs ]]; then
    if node /patch-dsh.mjs; then
        echo "[DSH] Persistence patch completed"
    else
        echo "[DSH] WARN: Some optional persistence patches failed"
        echo "[DSH] Continuing"
    fi
else
    echo "[DSH] No persistence patch found"
fi

# Disable noisy session probe if it exists.
export PROBE_DISABLED=1

# ==========================================================
# 2b. Install DSH web UI plugins
# ==========================================================

# ==========================================================
# 2b. Install DSH web UI plugins
# ==========================================================

echo
echo "=========================================================="
echo "[2b/7] Installing DSH web UI plugins"
echo "=========================================================="

PLUGINS=(
    "@hytime/dsh-client-ui-shortcuts@0.1.12"
    "dsh-ui-appearance"
    "dsh-better-sidebar@latest"
    "dshmarket"
    "dsh-skill-picker"
)

FAILED_PLUGINS=()

for plugin in "${PLUGINS[@]}"; do
    echo
    echo "[DSH] Installing $plugin ..."

    if dsh plugin --profile web add "$plugin"; then
        echo "[DSH] Successfully installed $plugin"
    else
        echo "[DSH] Initial install failed for $plugin"
        FAILED_PLUGINS+=("$plugin")
    fi
done

# Approve pnpm build scripts if needed
if [ ${#FAILED_PLUGINS[@]} -gt 0 ]; then
    echo
    echo "[DSH] Some plugins failed. Attempting pnpm build approval..."

    if [ -d "/data/profiles/web" ]; then
        cd /data/profiles/web
    elif [ -d "$HOME/.dsh/profiles/web" ]; then
        cd "$HOME/.dsh/profiles/web"
    fi

    pnpm approve-builds --all || true

    echo
    echo "[DSH] Retrying failed plugins..."

    STILL_FAILED=()

    for plugin in "${FAILED_PLUGINS[@]}"; do
        echo "[DSH] Retrying $plugin ..."

        if dsh plugin --profile web add "$plugin"; then
            echo "[DSH] Successfully installed $plugin"
        else
            echo "[DSH] ERROR: Failed to install $plugin"
            STILL_FAILED+=("$plugin")
        fi
    done

    if [ ${#STILL_FAILED[@]} -gt 0 ]; then
        echo
        echo "[DSH] The following plugins could not be installed:"
        printf ' - %s\n' "${STILL_FAILED[@]}"
        exit 1
    fi
fi

echo
echo "[DSH] Installed plugins:"
dsh plugin --profile web list || true







# ==========================================================
# 3. Configure llama.cpp
# ==========================================================

echo
echo "=========================================================="
echo "[3/7] Configuring llama.cpp"
echo "=========================================================="

export LD_LIBRARY_PATH="/app:/usr/local/lib:/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"

echo "[LLAMA] LD_LIBRARY_PATH:"
echo "${LD_LIBRARY_PATH}"

# Find llama-server if configured path doesn't exist.
if [[ ! -x "${LLAMA_SERVER}" ]]; then

    echo "[LLAMA] Configured server not found:"
    echo "${LLAMA_SERVER}"

    for candidate in \
        /app/llama-server \
        /opt/llama/llama-server \
        /usr/local/bin/llama-server \
        /usr/bin/llama-server
    do
        if [[ -x "${candidate}" ]]; then
            LLAMA_SERVER="${candidate}"
            echo "[LLAMA] Found:"
            echo "${LLAMA_SERVER}"
            break
        fi
    done
fi

if [[ ! -x "${LLAMA_SERVER}" ]]; then
    echo
    echo "[LLAMA] ERROR: llama-server not found"
    echo "[LLAMA] Searching container..."

    find /app /opt /usr/local/bin /usr/bin \
        -type f \
        -name "llama-server" \
        2>/dev/null \
        | head -20 || true

    exit 1
fi

echo "[LLAMA] Server:"
echo "${LLAMA_SERVER}"

echo
echo "[LLAMA] Version:"

"${LLAMA_SERVER}" --version || {
    echo "[LLAMA] ERROR: llama-server cannot start"
    exit 1
}

# ==========================================================
# 3b. Model fallback
# ==========================================================

echo
echo "=========================================================="
echo "[LLAMA] Checking model"
echo "=========================================================="

if [[ -f "${MODEL_PATH}" ]]; then

    echo "[LLAMA] Model found:"
    ls -lh "${MODEL_PATH}"

else

    echo "[LLAMA] Model not found:"
    echo "${MODEL_PATH}"

    if [[ -n "${HF_MODEL_REPO}" ]]; then

        echo
        echo "[HF] Attempting model fallback"
        echo "[HF] Repo: ${HF_MODEL_REPO}"
        echo "[HF] File: ${HF_MODEL_FILE}"

        if [[ -n "${HF_TOKEN:-}" ]]; then
            echo "[HF] HF_TOKEN available"
        else
            echo "[HF] WARNING: HF_TOKEN not available"
            echo "[HF] Trying unauthenticated download"
        fi

        if ! python3 -c "import huggingface_hub" >/dev/null 2>&1; then
            echo "[HF] Installing huggingface_hub..."

            python3 -m pip install \
                --no-cache-dir \
                huggingface_hub
        fi

        mkdir -p "$(dirname "${MODEL_PATH}")"

        if HF_MODEL_REPO="${HF_MODEL_REPO}" \
           HF_MODEL_FILE="${HF_MODEL_FILE}" \
           HF_TOKEN="${HF_TOKEN:-}" \
           MODEL_PATH="${MODEL_PATH}" \
           python3 - <<'PY'
import os
from huggingface_hub import hf_hub_download

repo = os.environ["HF_MODEL_REPO"]
filename = os.environ["HF_MODEL_FILE"]
token = os.environ.get("HF_TOKEN") or None
local_dir = os.path.dirname(os.environ["MODEL_PATH"])

print(f"[HF] Downloading {repo}/{filename}")

hf_hub_download(
    repo_id=repo,
    filename=filename,
    local_dir=local_dir,
    token=token,
)

print("[HF] Model download complete")
PY
        then
            echo "[HF] Model downloaded"
        else
            echo "[HF] ERROR: model download failed"
            exit 1
        fi
    fi
fi

# ----------------------------------------------------------
# Verify model
# ----------------------------------------------------------

if [[ ! -f "${MODEL_PATH}" ]]; then
    echo
    echo "[LLAMA] ERROR: Model still not found:"
    echo "${MODEL_PATH}"
    echo
    echo "[LLAMA] Files under /app:"
    ls -lah /app || true
    exit 1
fi

echo
echo "[LLAMA] Model ready:"
ls -lh "${MODEL_PATH}"

# ==========================================================
# 3c. Optional MMProj
# ==========================================================

echo
echo "=========================================================="
echo "[LLAMA] Checking optional MMProj"
echo "=========================================================="

if [[ -f "${MMPROJ_PATH}" ]]; then

    echo "[LLAMA] MMProj found:"
    ls -lh "${MMPROJ_PATH}"

else

    echo "[LLAMA] MMProj not found"
    echo "[LLAMA] Trying HF fallback..."

    if [[ -n "${HF_MODEL_REPO}" ]]; then

        if [[ ! -f "${MMPROJ_PATH}" ]]; then

            if python3 -c "import huggingface_hub" >/dev/null 2>&1; then

                HF_MODEL_REPO="${HF_MODEL_REPO}" \
                HF_MMPROJ_FILE="${HF_MMPROJ_FILE}" \
                HF_TOKEN="${HF_TOKEN:-}" \
                MMPROJ_PATH="${MMPROJ_PATH}" \
                python3 - <<'PY' || true

import os
from huggingface_hub import hf_hub_download

repo = os.environ["HF_MODEL_REPO"]
filename = os.environ["HF_MMPROJ_FILE"]
token = os.environ.get("HF_TOKEN") or None
local_dir = os.path.dirname(os.environ["MMPROJ_PATH"])

print(f"[HF] Trying optional MMProj: {repo}/{filename}")

try:
    hf_hub_download(
        repo_id=repo,
        filename=filename,
        local_dir=local_dir,
        token=token,
    )

    print("[HF] MMProj downloaded")

except Exception as e:
    print(f"[HF] MMProj unavailable: {e}")

PY

            fi
        fi
    fi
fi

if [[ -f "${MMPROJ_PATH}" ]]; then

    echo "[LLAMA] MMProj enabled:"
    ls -lh "${MMPROJ_PATH}"

else

    echo "[LLAMA] No MMProj"
    echo "[LLAMA] Running text-only"

fi

# ==========================================================
# 4. Start llama.cpp
# ==========================================================

echo
echo "=========================================================="
echo "[4/7] Starting llama.cpp"
echo "=========================================================="

LLAMA_ARGS=(
    -m "${MODEL_PATH}"

    --jinja

    --host "${LLAMA_HOST}"
    --port "${LLAMA_PORT}"

    --alias "${MODEL_NAME}"

    # CPU / memory configuration
    -t "${LLAMA_THREADS}"
    -c "${LLAMA_CONTEXT}"
    -n "${LLAMA_MAX_TOKENS}"

    # One request at a time.
    --parallel 1

    # KV cache
    --cache-type-k q8_0
    --cache-type-v q8_0

    --api-key "${LLAMA_API_KEY}"

    --no-webui
)

if [[ -f "${MMPROJ_PATH}" ]]; then
    LLAMA_ARGS+=(
        --mmproj "${MMPROJ_PATH}"
    )
fi

echo
echo "[LLAMA] Command:"
printf ' %q' "${LLAMA_SERVER}" "${LLAMA_ARGS[@]}"
echo
echo

rm -f /tmp/llama.log

echo "[LLAMA] Starting with LIVE logging"

"${LLAMA_SERVER}" "${LLAMA_ARGS[@]}" \
    > >(tee -a /tmp/llama.log) \
    2> >(tee -a /tmp/llama.log >&2) &

LLAMA_PID=$!

echo "[LLAMA] PID=${LLAMA_PID}"

# ==========================================================
# 4b. Wait for llama
# ==========================================================

echo
echo "[LLAMA] Waiting for API..."

LLAMA_UP=0

for _ in $(seq 1 180); do

    if ! kill -0 "${LLAMA_PID}" 2>/dev/null; then

        echo
        echo "[LLAMA] ERROR: llama-server exited"
        echo "----------------------------------------------------------"
        cat /tmp/llama.log || true
        echo "----------------------------------------------------------"

        exit 1
    fi

    if curl -sf \
        -H "Authorization: Bearer ${LLAMA_API_KEY}" \
        "http://${LLAMA_HOST}:${LLAMA_PORT}/v1/models" \
        >/tmp/llama-models.json 2>/dev/null
    then
        LLAMA_UP=1
        break
    fi

    sleep 1
done

if [[ "${LLAMA_UP}" != "1" ]]; then

    echo
    echo "[LLAMA] ERROR: server did not become ready"
    echo "----------------------------------------------------------"
    cat /tmp/llama.log || true
    echo "----------------------------------------------------------"

    exit 1
fi

echo
echo "=========================================================="
echo "[LLAMA] READY"
echo "=========================================================="

echo "[LLAMA] Models:"
cat /tmp/llama-models.json || true

echo
echo "[LLAMA] API:"
echo "http://${LLAMA_HOST}:${LLAMA_PORT}/v1"

# ==========================================================
# 5. Configure DSH local provider
# ==========================================================

echo
echo "=========================================================="
echo "[5/7] Configuring DSH LOCAL provider"
echo "=========================================================="

export LLAMA_API_KEY="local"

rm -f "${DSH_HOME}/settings.yaml"

cat > "${DSH_HOME}/settings.yaml" <<EOF
llm-pi-ai:
  providers:
    llama:
      displayName: LFM2.5 Local
      api: openai-completions
      baseURL: http://127.0.0.1:${LLAMA_PORT}/v1
      apiKeyEnv: LLAMA_API_KEY
      models:
        - id: ${MODEL_NAME}

agent-default-model:
  provider: llama
  model: ${MODEL_NAME}
EOF

echo "=========================================================="
echo "[5/7] Configuring DSH providers"
echo "=========================================================="

export LLAMA_API_KEY="local"

rm -f "${DSH_HOME}/settings.yaml"

cat > "${DSH_HOME}/settings.yaml" <<EOF
llm-pi-ai:
  providers:

    # ========================================================
    # QWEN
    # ========================================================
    qwen:
      displayName: Qwen 3.8 Flash Next
      api: openai-completions
      baseURL: https://pnywsahxhac1qjbo.us-east-2.aws.endpoints.huggingface.cloud/v1
      apiKeyEnv: HF_TOKEN
      models:
        - id: Qwen/Qwen3.8-Flash-Next

    # ========================================================
    # LOCAL LLAMA
    # ========================================================
    llama:
      displayName: LFM2.5 Local
      api: openai-completions
      baseURL: http://127.0.0.1:${LLAMA_PORT}/v1
      apiKeyEnv: LLAMA_API_KEY
      models:
        - id: ${MODEL_NAME}

    # ========================================================
    # AGNES AI
    # ========================================================
    agnes:
      displayName: Agnes AI
      api: openai-completions
      baseURL: https://apihub.agnes-ai.com/v1
      apiKeyEnv: AGNES_API_KEY
      models:
        - id: agnes-2.5-flash

    # ========================================================
    # OPENROUTER - MINIMAX M3
    # ========================================================
    openrouter_minimax:
      displayName: OpenRouter - MiniMax M3
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: minimax/minimax-m3:free

    openrouter_nemotron_ultra:
      displayName: OpenRouter - Nemotron Ultra 550B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: nvidia/nemotron-3-ultra-550b-a55b:free

    openrouter_nemotron_super:
      displayName: OpenRouter - Nemotron Super 120B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: nvidia/nemotron-3-super-120b-a12b:free

    openrouter_glm52:
      displayName: OpenRouter - GLM 5.2
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: z-ai/glm-5.2:free

    openrouter_gemma4:
      displayName: OpenRouter - Gemma 4 31B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: google/gemma-4-31b-it:free

    openrouter_kimi:
      displayName: OpenRouter - Kimi K2
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: moonshotai/kimi-k2:free

    openrouter_qwen:
      displayName: OpenRouter - Qwen3 Coder
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: qwen/qwen3-coder:free

    openrouter_deepseek:
      displayName: OpenRouter - DeepSeek V3.1
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: deepseek/deepseek-chat-v3.1:free

    openrouter_llama:
      displayName: OpenRouter - Llama 3.3 70B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: meta-llama/llama-3.3-70b-instruct:free

    openrouter_mistral:
      displayName: OpenRouter - Mistral Small 3.2
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      models:
        - id: mistralai/mistral-small-3.2-24b-instruct:free

    # ========================================================
    # OPENAI
    # ========================================================
    openai:
      displayName: OpenAI
      api: openai-completions
      baseURL: https://api.openai.com/v1
      apiKeyEnv: OPENAI_API_KEY
      models:
        - id: ${OPENAI_MODEL_NAME}

agent-default-model:
  provider: llama
  model: ${MODEL_NAME}
EOF

echo
echo "=========================================================="
echo "[DSH] settings.yaml"
echo "=========================================================="

cat "${DSH_HOME}/settings.yaml"

echo
echo "=========================================================="
echo "[DSH] Providers"
echo "=========================================================="
echo "  llama      -> http://127.0.0.1:${LLAMA_PORT}/v1"
echo "  agnes      -> https://apihub.agnes-ai.com/v1"
echo "  openrouter -> https://openrouter.ai/api/v1"
echo "  openai     -> https://api.openai.com/v1"
echo
echo "[DSH] Models"
echo "  llama      -> ${MODEL_NAME}"
echo "  agnes      -> agnes-2.5-flash"
echo "  openrouter -> stealth/ox-alpha"
echo "  openai     -> ${OPENAI_MODEL_NAME}"
echo
echo "[DSH] Default provider: llama"
echo "[DSH] Default model: ${MODEL_NAME}"

unset DEEPSEEK_API_KEY 2>/dev/null || true

# ==========================================================
# 6. Start DSH
# ==========================================================

echo
echo "=========================================================="
echo "[6/7] Starting DSH web UI"
echo "=========================================================="

dsh web \
    --port "${DSH_INTERNAL_PORT}" \
    --no-open &

DSH_PID=$!

echo "[DSH] PID=${DSH_PID}"

echo "[DSH] Waiting for web UI..."

DSH_UP=0

for _ in $(seq 1 150); do

    if ! kill -0 "${DSH_PID}" 2>/dev/null; then

        echo
        echo "[DSH] ERROR: dsh exited early"

        exit 1
    fi

    if curl -sf \
        "http://127.0.0.1:${DSH_INTERNAL_PORT}/" \
        >/dev/null 2>&1
    then

        DSH_UP=1
        break

    fi

    sleep 1
done

if [[ "${DSH_UP}" != "1" ]]; then
    echo "[DSH] WARNING: web UI not responding yet"
fi

# ==========================================================
# 7. Nginx
# ==========================================================

echo
echo "=========================================================="
echo "[7/7] Configuring nginx"
echo "=========================================================="

WEBUI_PASSWORD="${WEBUI_PASSWORD:-}"

if [[ -z "${WEBUI_PASSWORD}" ]]; then
    echo "[NGINX] WARNING: WEBUI_PASSWORD not set"
    WEBUI_PASSWORD="changeme"
fi

htpasswd -bc \
    /etc/nginx/.htpasswd \
    admin \
    "${WEBUI_PASSWORD}" \
    >/dev/null 2>&1

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
    listen ${PORT};
    server_name _;

    # ------------------------------------------------------
    # Health
    # ------------------------------------------------------

    location = /healthz {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    # ------------------------------------------------------
    # DSH plugins
    # ------------------------------------------------------

    location /plugins/ {
        auth_basic "DeepSeek Harness";
        auth_basic_user_file /etc/nginx/.htpasswd;

        sub_filter_once off;
        sub_filter_types text/javascript application/javascript;

        sub_filter '"/api"' '"/dshgw"';
        sub_filter '/api/' '/dshgw/';

        proxy_pass http://127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host 127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_set_header Origin "";

        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        proxy_buffering off;
    }

    # ------------------------------------------------------
    # Rewritten DSH API
    # ------------------------------------------------------

    location /dshgw/ {
        auth_basic "DeepSeek Harness";
        auth_basic_user_file /etc/nginx/.htpasswd;

        rewrite ^/dshgw/(.*)$ /api/\$1 break;

        proxy_pass http://127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host 127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_set_header Origin "";

        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        proxy_buffering off;
    }

    # ------------------------------------------------------
    # Everything else -> DSH
    # ------------------------------------------------------

    location / {
        auth_basic "DeepSeek Harness";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host 127.0.0.1:${DSH_INTERNAL_PORT};
        proxy_set_header Origin "";

        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        proxy_buffering off;
    }
}
EOF

echo "[NGINX] Configuration test"

nginx -t

echo
echo "=========================================================="
echo "[NGINX] Starting :${PORT}"
echo "=========================================================="

nginx -g 'daemon off;' &

NGINX_PID=$!

# ==========================================================
# Cleanup
# ==========================================================

cleanup() {

    echo
    echo "=========================================================="
    echo "[EXIT] Stopping services"
    echo "=========================================================="

    kill "${NGINX_PID}" 2>/dev/null || true
    kill "${DSH_PID}" 2>/dev/null || true
    kill "${LLAMA_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# ==========================================================
# READY
# ==========================================================

echo
echo "=========================================================="
echo " READY"
echo "=========================================================="
echo
echo "DSH:       http://127.0.0.1:${DSH_INTERNAL_PORT}"
echo "LLAMA:     http://127.0.0.1:${LLAMA_PORT}/v1"
echo "MODEL:     ${MODEL_NAME}"
echo "PROVIDER:  llama"
echo "CONTEXT:   ${LLAMA_CONTEXT}"
echo "THREADS:   ${LLAMA_THREADS}"
echo "PARALLEL:  1"
echo "KV CACHE:  Q8_0"
echo
echo "PLUGINS:"
echo "  @hytime/dsh-client-ui-shortcuts@0.1.12"
echo "  dsh-ui-appearance"
echo
echo "PUBLIC:    http://<space-host>:${PORT}"
echo
echo "=========================================================="
echo " LIVE LLAMA LOG"
echo "=========================================================="
echo

# ==========================================================
# Keep container alive
# ==========================================================

while true; do

    if ! kill -0 "${LLAMA_PID}" 2>/dev/null; then

        echo
        echo "[FATAL] llama.cpp stopped"
        echo "----------------------------------------------------------"
        cat /tmp/llama.log 2>/dev/null || true
        echo "----------------------------------------------------------"

        exit 1
    fi

    if ! kill -0 "${DSH_PID}" 2>/dev/null; then

        echo
        echo "[FATAL] DSH stopped"

        exit 1
    fi

    if ! kill -0 "${NGINX_PID}" 2>/dev/null; then

        echo
        echo "[FATAL] nginx stopped"

        exit 1
    fi

    sleep 5

done
