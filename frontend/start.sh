#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "[error] npm est introuvable. Installe Node.js + npm." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[start] Installation des dépendances frontend..."
  npm install
fi

echo "[start] Lancement frontend (Next.js dev)"
exec npm run dev
