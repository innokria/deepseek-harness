#!/bin/bash
set -e

# ==========================================================
# DeepSeek Harness 1.0
# Hugging Face Space
#
# Architecture:
#
# Internet
#    │
#    ▼
# nginx :7860
#    │
#    ▼
# DSH :3080 (127.0.0.1 only)
#    │
#    ├── Western providers
#    ├── Chinese providers
#    ├── OpenRouter models
#    └── Optional providers
#
# NOTE:
# Provider declarations do NOT themselves implement
# automatic cross-provider failover.
# ==========================================================

export DSH_HOME="${DSH_HOME:-/data/dsh}"
export DSH_PORT="${DSH_PORT:-3080}"
export PORT="${PORT:-7860}"
export DSH_HOST="${DSH_HOST:-127.0.0.1}"
export DSH_TRUSTED_HOST="${DSH_TRUSTED_HOST:-rahul7star-deepseek-harness.hf.space}"

echo
echo "=========================================================="
echo "DeepSeek Harness - OhamLab HF Space"
echo "=========================================================="
echo "[DSH] Repository:     innokria/deepseek-harness"
echo "[DSH] Version:        1.0"
echo "[DSH] DSH_HOME:       ${DSH_HOME}"
echo "[DSH] Internal:       ${DSH_HOST}:${DSH_PORT}"
echo "[DSH] Public:         0.0.0.0:${PORT}"
echo "[DSH] Trusted host:   ${DSH_TRUSTED_HOST}"
echo

# ==========================================================
# 1. Prepare persistent + local storage
# ==========================================================

echo "=========================================================="
echo "[1/8] Preparing storage"
echo "=========================================================="

mkdir -p "${DSH_HOME}"

mkdir -p \
    "${DSH_HOME}/profiles" \
    "${DSH_HOME}/plugins" \
    "${DSH_HOME}/workspaces" \
    "${DSH_HOME}/cache" \
    "${DSH_HOME}/logs" \
    "${DSH_HOME}/tmp"

# ----------------------------------------------------------
# Sessions MUST use local container storage.
# ----------------------------------------------------------

rm -rf "${DSH_HOME}/sessions"

mkdir -p /tmp/dsh-sessions

ln -s /tmp/dsh-sessions "${DSH_HOME}/sessions"

echo "[DSH] Persistent storage: ${DSH_HOME}"
echo "[DSH] Session storage:     ${DSH_HOME}/sessions -> /tmp/dsh-sessions"

# ==========================================================
# 2. Fix filesystem permissions
# ==========================================================

echo
echo "=========================================================="
echo "[2/8] Fixing /data permissions"
echo "=========================================================="

chmod 755 /data 2>/dev/null || true

chmod 700 "${DSH_HOME}" 2>/dev/null || true

chmod 700 \
    "${DSH_HOME}/profiles" \
    "${DSH_HOME}/plugins" \
    "${DSH_HOME}/workspaces" \
    "${DSH_HOME}/cache" \
    "${DSH_HOME}/logs" \
    "${DSH_HOME}/tmp" \
    /tmp/dsh-sessions \
    2>/dev/null || true

# ==========================================================
# 2b. Optional plugins
# ==========================================================

echo
echo "=========================================================="
echo "[2b/8] Installing optional plugins"
echo "=========================================================="

export PROBE_DISABLED=1

cd /app/deepseek-harness

PROFILE_DIR="${DSH_HOME}/profiles/web"

PLUGINS=(
    "@hytime/dsh-client-ui-shortcuts@0.1.12"
    "dshmarket"
    "dsh-skill-picker"
)

# ----------------------------------------------------------
# Remove known incompatible plugins
# ----------------------------------------------------------

echo "[PLUGIN] Removing known incompatible plugins..."

BAD_PLUGINS=(
    "dsh-better-sidebar"
    "dsh-ui-appearance"
)

for PLUGIN in "${BAD_PLUGINS[@]}"; do

    echo "[PLUGIN] Disabling: ${PLUGIN}"

    pnpm dsh plugin \
        --profile web \
        remove "${PLUGIN}" \
        >/tmp/plugin-remove.log 2>&1 || true

    rm -rf \
        "${PROFILE_DIR}/node_modules/${PLUGIN}" \
        "${PROFILE_DIR}/node_modules/.pnpm"/"${PLUGIN}"* \
        2>/dev/null || true

done

# ----------------------------------------------------------
# Install optional plugins
# ----------------------------------------------------------

for PLUGIN in "${PLUGINS[@]}"; do

    echo
    echo "[PLUGIN] Installing: ${PLUGIN}"

    if pnpm dsh plugin \
        --profile web \
        add "${PLUGIN}"; then

        echo "[PLUGIN] OK: ${PLUGIN}"

    else

        echo "[PLUGIN] WARNING: failed to install ${PLUGIN}"
        echo "[PLUGIN] Continuing without ${PLUGIN}"

    fi

done

# ----------------------------------------------------------
# Approve optional dependencies
# ----------------------------------------------------------

echo
echo "[PLUGIN] Approving optional build scripts..."

pnpm approve-builds --all \
    >/tmp/plugin-approve.log 2>&1 || true

# ----------------------------------------------------------
# Plugin list diagnostic only
# ----------------------------------------------------------

echo
echo "[PLUGIN] Installed plugins:"

pnpm dsh plugin \
    --profile web \
    list \
    2>&1 || true

echo
echo "[PLUGIN] Plugin setup complete"
echo "[PLUGIN] Plugin failures are non-fatal"

# ==========================================================
# Show installed plugins
# ==========================================================

echo
echo "=========================================================="
echo "[DSH] Installed web plugins"
echo "=========================================================="

cd /app/deepseek-harness

pnpm dsh plugin \
    --profile web \
    list \
    2>&1 || true

# ==========================================================
# 3. Configure DSH providers
# ==========================================================

echo
echo "=========================================================="
echo "[3/8] Configuring DSH providers"
echo "=========================================================="

SETTINGS_FILE="${DSH_HOME}/settings.yaml"

cat > "${SETTINGS_FILE}" <<'EOF'

# ============================================================
# DeepSeek Harness - LLM Provider Pool
#
# Provider groups:
#
#   1. Western providers
#   2. Chinese providers - FIRST CLASS
#   3. OpenRouter individual free models
#   4. OpenRouter dynamic free pool
#   5. Optional providers
#
# Chinese providers are NOT last-resort providers.
# They belong to the same provider pool as Groq/Gemini/etc.
# ============================================================

llm-pi-ai:
  providers:

    # ========================================================
    # WESTERN PROVIDERS
    # ========================================================

    groq:
      displayName: Groq Free
      api: openai-completions
      baseURL: https://api.groq.com/openai/v1
      apiKeyEnv: GROQ_API_KEY
      timeoutMs: 120000
      models:
        - id: openai/gpt-oss-120b
        - id: openai/gpt-oss-20b
        - id: openai/gpt-oss-safeguard-20b
        - id: qwen/qwen3.8-27b

    cerebras:
      displayName: Cerebras
      api: openai-completions
      baseURL: https://api.cerebras.ai/v1
      apiKeyEnv: CEREBRAS_API_KEY
      timeoutMs: 120000
      models:
        - id: gpt-oss-120b

    gemini:
      displayName: Google Gemini
      api: openai-completions
      baseURL: https://generativelanguage.googleapis.com/v1beta/openai
      apiKeyEnv: GEMINI_API_KEY
      timeoutMs: 120000
      models:
        - id: gemini-2.5-flash
        - id: gemini-2.5-flash-lite

    mistral:
      displayName: Mistral
      api: openai-completions
      baseURL: https://api.mistral.ai/v1
      apiKeyEnv: MISTRAL_API_KEY
      timeoutMs: 120000
      models:
        - id: mistral-small-latest

    sambanova:
      displayName: SambaNova
      api: openai-completions
      baseURL: https://api.sambanova.ai/v1
      apiKeyEnv: SAMBANOVA_API_KEY
      timeoutMs: 120000
      models:
        - id: Meta-Llama-3.3-70B-Instruct

    cohere:
      displayName: Cohere
      api: openai-completions
      baseURL: https://api.cohere.com/compatibility/v1
      apiKeyEnv: COHERE_API_KEY
      timeoutMs: 120000
      models:
        - id: command-a-03-2025

    # ========================================================
    # CHINESE PROVIDERS - FIRST CLASS
    # ========================================================

    siliconflow:
      displayName: SiliconFlow
      api: openai-completions
      baseURL: https://api.siliconflow.cn/v1
      apiKeyEnv: SILICONFLOW_API_KEY
      timeoutMs: 120000
      models:
        - id: Qwen/Qwen3-8B
        - id: deepseek-ai/DeepSeek-R1-Distill-Qwen-7B

    modelscope:
      displayName: ModelScope
      api: openai-completions
      baseURL: https://api-inference.modelscope.cn/v1
      apiKeyEnv: MODELSCOPE_API_KEY
      timeoutMs: 120000
      models:
        - id: Qwen/Qwen3-8B

    zai:
      displayName: Z.ai GLM
      api: openai-completions
      baseURL: https://api.z.ai/v1
      apiKeyEnv: ZAI_API_KEY
      timeoutMs: 120000
      models:
        - id: glm-4.5-flash
        - id: glm-4.7-flash

    dashscope_qwen:
      displayName: Alibaba Qwen 3.8 Flash
      api: openai-completions
      baseURL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
      apiKeyEnv: DASHSCOPE_API_KEY
      timeoutMs: 120000
      models:
        - id: qwen3.8-flash

    dashscope_deepseek:
      displayName: Alibaba DeepSeek V4 Flash
      api: openai-completions
      baseURL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
      apiKeyEnv: DASHSCOPE_API_KEY
      timeoutMs: 120000
      models:
        - id: deepseek-v4-flash

    qianfan:
      displayName: Baidu Qianfan
      api: openai-completions
      baseURL: https://qianfan.baidubce.com/v2
      apiKeyEnv: QIANFAN_API_KEY
      timeoutMs: 120000
      models:
        - id: deepseek-v3
        - id: qwen3-32b

    volcengine:
      displayName: Volcengine Doubao
      api: openai-completions
      baseURL: https://ark.cn-beijing.volces.com/api/v3
      apiKeyEnv: VOLCENGINE_API_KEY
      timeoutMs: 120000
      models:
        - id: doubao-seed-1-6-flash

    # ========================================================
    # OPENROUTER - DYNAMIC FREE POOL
    # ========================================================

    openrouter:
      displayName: OpenRouter - Dynamic Free
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: openrouter/free

    # ========================================================
    # OPENROUTER - INDIVIDUAL FREE MODELS
    # ========================================================

    openrouter_minimax:
      displayName: OpenRouter - MiniMax M3
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: minimax/minimax-m3:free

    openrouter_nemotron_ultra:
      displayName: OpenRouter - Nemotron Ultra
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: nvidia/nemotron-3-ultra-550b-a55b:free

    openrouter_nemotron_super:
      displayName: OpenRouter - Nemotron Super
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: nvidia/nemotron-3-super-120b-a12b:free

    openrouter_glm52:
      displayName: OpenRouter - GLM 5.2
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: z-ai/glm-5.2:free

    openrouter_gemma4:
      displayName: OpenRouter - Gemma 4 31B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: google/gemma-4-31b-it:free

    openrouter_kimi:
      displayName: OpenRouter - Kimi K2
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: moonshotai/kimi-k2:free

    openrouter_qwen:
      displayName: OpenRouter - Qwen3 Coder
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: qwen/qwen3-coder:free

    openrouter_deepseek:
      displayName: OpenRouter - DeepSeek V3.1
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: deepseek/deepseek-chat-v3.1:free

    openrouter_llama:
      displayName: OpenRouter - Llama 3.3 70B
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: meta-llama/llama-3.3-70b-instruct:free

    openrouter_mistral:
      displayName: OpenRouter - Mistral Small
      api: openai-completions
      baseURL: https://openrouter.ai/api/v1
      apiKeyEnv: OPENROUTER_API_KEY
      timeoutMs: 120000
      models:
        - id: mistralai/mistral-small-3.2-24b-instruct:free

    # ========================================================
    # HUGGING FACE
    # ========================================================

    huggingface:
      displayName: Hugging Face Router
      api: openai-completions
      baseURL: https://router.huggingface.co/v1
      apiKeyEnv: HF_TOKEN
      timeoutMs: 120000
      models:
        - id: openai/gpt-oss-120b
        - id: openai/gpt-oss-20b

    # ========================================================
    # QWEN ENDPOINTS
    # ========================================================

    dashscope_qwen_flash_next:
      displayName: Qwen 3.8 Flash Next
      api: openai-completions
      baseURL: https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1
      apiKeyEnv: DASHSCOPE_API_KEY
      timeoutMs: 120000
      models:
        - id: Qwen/Qwen3.8-Flash-Next

    qwen:
      displayName: Qwen 3.8 Flash Next
      api: openai-completions
      baseURL: https://pnywsahxhac1qjbo.us-east-2.aws.endpoints.huggingface.cloud/v1
      apiKeyEnv: HF_TOKEN
      timeoutMs: 120000
      models:
        - id: Qwen/Qwen3.8-Flash-Next

    # ========================================================
    # AGNES
    # ========================================================

    agnes:
      displayName: Agnes AI
      api: openai-completions
      baseURL: https://apihub.agnes-ai.com/v1
      apiKeyEnv: AGNES_API_KEY
      timeoutMs: 120000
      models:
        - id: agnes-2.5-flash

    # ========================================================
    # NVIDIA
    # ========================================================

    nvidia:
      displayName: NVIDIA NIM
      api: openai-completions
      baseURL: https://integrate.api.nvidia.com/v1
      apiKeyEnv: NVIDIA_API_KEY
      timeoutMs: 120000
      models:
        - id: openai/gpt-oss-120b

    # ========================================================
    # LOCAL LLAMA.CPP
    # ========================================================

    llama:
      displayName: LFM2.5 Local
      api: openai-completions
      baseURL: http://127.0.0.1:8000/v1
      apiKeyEnv: LLAMA_API_KEY
      timeoutMs: 120000
      models:
        - id: LFM2.5

# ============================================================
# DEFAULT
# ============================================================

agent-default-model:
  provider: groq
  model: openai/gpt-oss-120b

EOF

chmod 600 "${SETTINGS_FILE}"

echo "[DSH] Settings file: ${SETTINGS_FILE}"
echo "[DSH] Provider pool configured"
echo "[DSH] Default model: groq / openai/gpt-oss-120b"

echo
echo "[DSH] Configured providers:"
grep -E "^    [a-zA-Z0-9_-]+:$" \
    "${SETTINGS_FILE}" \
    || true

# ==========================================================
# 4. Credential security + availability
# ==========================================================

echo
echo "=========================================================="
echo "[4/8] Securing credentials + checking providers"
echo "=========================================================="

if [ -f "${DSH_HOME}/.credentials.yaml" ]; then

    echo "[DSH] Fixing .credentials.yaml permissions"

    chmod 600 "${DSH_HOME}/.credentials.yaml"

    ls -l "${DSH_HOME}/.credentials.yaml"

fi

find "${DSH_HOME}" \
    -type f \
    \( \
        -name ".credentials.yaml" \
        -o -name "*credentials*.yaml" \
        -o -name "*credentials*.yml" \
    \) \
    -exec chmod 600 {} \; \
    2>/dev/null || true

# ----------------------------------------------------------
# Never print API keys.
# ----------------------------------------------------------

check_env() {

    local NAME="$1"

    if [ -n "${!NAME:-}" ]; then
        echo "[PROVIDER] ${NAME}=configured"
    else
        echo "[PROVIDER] ${NAME}=NOT SET"
    fi

}

echo
echo "----------------------------------------------------------"
echo "[PROVIDER] Western"
echo "----------------------------------------------------------"

check_env GROQ_API_KEY
check_env CEREBRAS_API_KEY
check_env GEMINI_API_KEY
check_env MISTRAL_API_KEY
check_env SAMBANOVA_API_KEY
check_env COHERE_API_KEY

echo
echo "----------------------------------------------------------"
echo "[PROVIDER] Chinese - FIRST CLASS"
echo "----------------------------------------------------------"

check_env SILICONFLOW_API_KEY
check_env MODELSCOPE_API_KEY
check_env ZAI_API_KEY
check_env DASHSCOPE_API_KEY
check_env QIANFAN_API_KEY
check_env VOLCENGINE_API_KEY

echo
echo "----------------------------------------------------------"
echo "[PROVIDER] OpenRouter"
echo "----------------------------------------------------------"

check_env OPENROUTER_API_KEY

echo
echo "----------------------------------------------------------"
echo "[PROVIDER] Other"
echo "----------------------------------------------------------"

check_env HF_TOKEN
check_env NVIDIA_API_KEY
check_env AGNES_API_KEY
check_env LLAMA_API_KEY

echo
echo "[DSH] Provider credential check complete"

# ==========================================================
# 5. Verify write access
# ==========================================================

echo
echo "=========================================================="
echo "[5/8] Testing persistent storage"
echo "=========================================================="

WRITE_TEST="${DSH_HOME}/.write-test"

if ! touch "${WRITE_TEST}"; then

    echo "[ERROR] Cannot write to ${DSH_HOME}"

    exit 1

fi

echo "DSH storage write test OK" > "${WRITE_TEST}"

if ! cat "${WRITE_TEST}" >/dev/null; then

    echo "[ERROR] Cannot read from ${DSH_HOME}"

    exit 1

fi

rm -f "${WRITE_TEST}"

echo "[DSH] /data write: OK"
echo "[DSH] /data read:  OK"

# ==========================================================
# 6. Show storage state
# ==========================================================

echo
echo "=========================================================="
echo "[6/8] Storage state"
echo "=========================================================="

echo "[DSH] DSH directory:"
ls -ld "${DSH_HOME}" || true

echo
echo "[DSH] Session directory:"
ls -ld "${DSH_HOME}/sessions" || true

echo
echo "[DSH] Session target:"
readlink -f "${DSH_HOME}/sessions" || true

echo
echo "[DSH] Files:"
ls -la "${DSH_HOME}" || true

echo
echo "[DSH] Disk:"
df -h /data || true

echo
echo "[DSH] Local session disk:"
df -h /tmp || true

# ==========================================================
# 7. Start DeepSeek Harness
# ==========================================================

echo
echo "=========================================================="
echo "[7/8] Starting DSH Web UI"
echo "=========================================================="

cd /app/deepseek-harness

DSH_LOG="/tmp/dsh.log"

rm -f "${DSH_LOG}"

echo "[DSH] Starting:"
echo "pnpm dsh web --host ${DSH_HOST} --port ${DSH_PORT} --trusted-host ${DSH_TRUSTED_HOST} --no-open"

pnpm dsh web \
    --host "${DSH_HOST}" \
    --port "${DSH_PORT}" \
    --trusted-host "${DSH_TRUSTED_HOST}" \
    --no-open \
    >"${DSH_LOG}" 2>&1 &

DSH_PID=$!

echo "[DSH] PID=${DSH_PID}"
echo "[DSH] Waiting for Web UI..."

DSH_READY=0

for i in $(seq 1 120); do

    if ! kill -0 "${DSH_PID}" 2>/dev/null; then

        echo
        echo "[DSH] ERROR: DSH exited during startup"
        echo
        echo "===== DSH LOG ====="

        cat "${DSH_LOG}" || true

        exit 1

    fi

    if curl -sf \
        "http://${DSH_HOST}:${DSH_PORT}/" \
        >/dev/null 2>&1
    then

        DSH_READY=1

        echo "[DSH] Web UI is ready"

        break

    fi

    if [ $((i % 10)) -eq 0 ]; then

        echo "[DSH] Still waiting... ${i}/120"

    fi

    sleep 1

done

if [ "${DSH_READY}" -ne 1 ]; then

    echo
    echo "[DSH] ERROR: Web UI did not become ready"
    echo
    echo "===== DSH LOG ====="

    cat "${DSH_LOG}" || true

    echo
    echo "===== LISTENING PORTS ====="

    ss -lntp || true

    exit 1

fi

# ==========================================================
# DSH diagnostics
# ==========================================================

echo
echo "=========================================================="
echo "[DSH] Process"
echo "=========================================================="

ps -ef | grep -E "node|dsh" | grep -v grep || true

echo
echo "=========================================================="
echo "[DSH] Listening ports"
echo "=========================================================="

ss -lntp || true

echo
echo "=========================================================="
echo "[DSH] Startup Log"
echo "=========================================================="

cat "${DSH_LOG}" || true

if ! kill -0 "${DSH_PID}" 2>/dev/null; then

    echo
    echo "[DSH] ERROR: DSH died after startup"

    exit 1

fi

# ==========================================================
# 8. Start nginx
# ==========================================================

echo
echo "=========================================================="
echo "[8/8] Starting nginx :${PORT}"
echo "=========================================================="

nginx -t

nginx

echo "[NGINX] Started"
echo "[NGINX] Listening on :${PORT}"
echo "[NGINX] Proxying to ${DSH_HOST}:${DSH_PORT}"

# ==========================================================
# Monitor DSH
# ==========================================================

while true; do

    if ! kill -0 "${DSH_PID}" 2>/dev/null; then

        echo
        echo "=========================================================="
        echo "[DSH] PROCESS EXITED"
        echo "=========================================================="

        tail -300 "${DSH_LOG}" || true

        exit 1

    fi

    sleep 5

done
