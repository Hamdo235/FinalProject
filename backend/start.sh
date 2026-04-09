#!/usr/bin/env bash
set -euo pipefail

# Unified backend launcher: ensures Ollama is running and model present,
# exports LLM env vars, then starts FastAPI (uvicorn).

# 1) Ensure Ollama server is running
if ! pgrep -fl ollama >/dev/null 2>&1; then
  if command -v ollama >/dev/null 2>&1; then
    echo "[start] Starting ollama serve in background..."
    OLLAMA_LOG="${OLLAMA_LOG:-$(pwd)/data/ollama.log}"
    mkdir -p "$(dirname "$OLLAMA_LOG")" 2>/dev/null || true
    if ! touch "$OLLAMA_LOG" 2>/dev/null; then
      OLLAMA_LOG="/tmp/ollama.log"
      touch "$OLLAMA_LOG" 2>/dev/null || true
    fi
    nohup ollama serve > "$OLLAMA_LOG" 2>&1 &
    sleep 2
  else
    echo "[error] Ollama not found. Install it: https://ollama.com/download" >&2
    echo "        Or: curl -fsSL https://ollama.com/install.sh -o /tmp/ollama_install.sh && sudo bash /tmp/ollama_install.sh" >&2
    exit 1
  fi
fi

# 2) Export backend env vars for LLM
export OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://localhost:11434}
export OLLAMA_URL=${OLLAMA_URL:-$OLLAMA_BASE_URL}
export OLLAMA_MODEL=${OLLAMA_MODEL:-qwen2.5:1.5b}

# 2a) Runtime mode (dev/demo vs final)
# - APP_ENV=dev (default): DEBUG=1 and auto-reload enabled
# - APP_ENV=final: DEBUG=0 and reload disabled
APP_ENV=${APP_ENV:-dev}
if [ "$APP_ENV" = "final" ]; then
  export DEBUG=${DEBUG:-0}
  UVICORN_RELOAD=${UVICORN_RELOAD:-0}
else
  export DEBUG=${DEBUG:-1}
  UVICORN_RELOAD=${UVICORN_RELOAD:-1}
fi
echo "[start] Runtime mode: $APP_ENV (DEBUG=$DEBUG, RELOAD=$UVICORN_RELOAD)"

# 2c) Optional GeoIP: GeoLite2 City DB (offline, local file)
# If you place the mmdb at backend/data/GeoLite2-City.mmdb, it will be auto-detected.
DEFAULT_GEOLITE_DB="$(pwd)/data/GeoLite2-City.mmdb"
if [ -z "${GEOLITE2_CITY_DB:-}" ] && [ -f "$DEFAULT_GEOLITE_DB" ]; then
  export GEOLITE2_CITY_DB="$DEFAULT_GEOLITE_DB"
  echo "[start] GeoIP enabled (GeoLite2): $GEOLITE2_CITY_DB"
elif [ -z "${GEOLITE2_CITY_DB:-}" ]; then
  echo "[start] GeoIP disabled (missing GEOLITE2_CITY_DB). Map markers may be empty unless demo fallback applies."
fi

# 2b) Ensure the requested model is available (pull if missing)
if command -v ollama >/dev/null 2>&1; then
  # Wait briefly for ollama serve to accept requests
  for i in {1..10}; do
    if curl -sf "${OLLAMA_BASE_URL}/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  # Normalize model name (strip optional tag like :latest)
  OLLAMA_MODEL_BASE=${OLLAMA_MODEL%%:*}
  # List installed models, strip tags, compare names
  if ! ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | sed 's/:.*//' | grep -qx "$OLLAMA_MODEL_BASE"; then
    echo "[start] Pulling Ollama model: $OLLAMA_MODEL ..."
    ollama pull "$OLLAMA_MODEL"
  fi
fi

# 3) Launch backend API
cd "$(dirname "$0")"
APP_DIR="$(pwd)"
# Ensure local backend package resolution is deterministic for reload subprocesses
export PYTHONPATH="$APP_DIR${PYTHONPATH:+:$PYTHONPATH}"

# Reduce noisy Chroma telemetry warnings by default
export ANONYMIZED_TELEMETRY=${ANONYMIZED_TELEMETRY:-false}
# 3a) Activate local virtualenv if present
if [ -d .venv ] && [ -f .venv/bin/activate ]; then
  echo "[start] Activating virtualenv .venv"
  source .venv/bin/activate
fi

# 3b) Launch via python -m uvicorn to avoid missing uvicorn binary in PATH
PYTHON_BIN=${PYTHON:-python}

# 3b-setup) Ensure uvicorn installed; if not, auto-create venv and install requirements
if ! "$PYTHON_BIN" -c "import uvicorn" >/dev/null 2>&1; then
  echo "[start] Python env missing uvicorn. Bootstrapping .venv and installing requirements..."
  # Create venv if absent
  if [ ! -d .venv ]; then
    "$PYTHON_BIN" -m venv .venv
  fi
  # Activate and install
  source .venv/bin/activate
  pip install --upgrade pip
  if [ -f requirements.txt ]; then
    pip install -r requirements.txt
  else
    # Fallback minimal deps
    pip install uvicorn fastapi sqlmodel scikit-learn numpy sqlalchemy
  fi
fi

export GEOLITE2_CITY_DB="${GEOLITE2_CITY_DB:-/home/hamdo/Documents/MyProject/backend/data/GeoLite2-City.mmdb}"

UVICORN_ARGS=(app.main:app --host 0.0.0.0 --port 8000 --app-dir "$APP_DIR")
if [ "$UVICORN_RELOAD" = "1" ]; then
  UVICORN_ARGS+=(--reload --reload-dir "$APP_DIR")
fi

exec "$PYTHON_BIN" -m uvicorn "${UVICORN_ARGS[@]}"
