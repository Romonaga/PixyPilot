#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/backend/.venv"
STAMP="$VENV/.pixypilot-installed"
PYTHON_BIN="${PYTHON:-python3}"

if [ ! -x "$VENV/bin/python" ]; then
  "$PYTHON_BIN" -m venv "$VENV"
fi

if [ ! -f "$STAMP" ] || [ "$ROOT/backend/pyproject.toml" -nt "$STAMP" ]; then
  "$VENV/bin/python" -m pip install --upgrade pip
  "$VENV/bin/python" -m pip install -e "$ROOT/backend"
  touch "$STAMP"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  npm --prefix "$ROOT/frontend" install
fi

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  npm --prefix "$ROOT/frontend" run build
fi

exec "$VENV/bin/pixypilot-api"
