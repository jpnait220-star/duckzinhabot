#!/usr/bin/env bash
set -euo pipefail

# Pterodactyl/Altare mount server files at /home/container, while
# Kokoro's installed application and bundled models live in /app.
# The stock Kokoro image assumes /app is the working directory, so
# its relative default CMD may fail when the panel overrides cwd.
export PYTHONPATH="/app:/app/api${PYTHONPATH:+:${PYTHONPATH}}"
export TEMP_FILE_DIR="/tmp/duckzinha-kokoro"
mkdir -p "$TEMP_FILE_DIR"

# Respect Altare's primary allocation and fall back to this server's
# assigned port. Avoid relying on the generic Python egg's STARTUP command.
KOKORO_PORT="${SERVER_PORT:-${PORT:-25715}}"
if [[ ! "$KOKORO_PORT" =~ ^[0-9]+$ ]]; then
  echo "[Duckzinha Kokoro] Invalid port '$KOKORO_PORT'" >&2
  exit 1
fi

echo "[Duckzinha Kokoro] Starting API on 0.0.0.0:$KOKORO_PORT"
cd /app
exec /app/.venv/bin/python -m uvicorn api.src.main:app \
  --host 0.0.0.0 \
  --port "$KOKORO_PORT" \
  --log-level info
