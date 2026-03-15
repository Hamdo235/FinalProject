#!/usr/bin/env bash
set -euo pipefail

# Helper: create + activate backend virtualenv quickly.
# Usage:
#   source ./venv.sh        # activate in current shell (recommended)
#   ./venv.sh               # opens a new interactive shell with venv activated

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_BIN="${PYTHON:-python3}"

if [ ! -d "$VENV_DIR" ]; then
  echo "[venv] Creating virtual environment at $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

if [ ! -f "$VENV_DIR/bin/activate" ]; then
  echo "[venv] Missing activate script: $VENV_DIR/bin/activate" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "[venv] Activated: $VIRTUAL_ENV"
echo "[venv] Python: $(command -v python)"

# If script is executed (not sourced), keep user in an interactive shell with venv active.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "[venv] Opening a subshell with virtualenv active. Type 'exit' to return."
  exec "${SHELL:-/bin/bash}" -i
fi
