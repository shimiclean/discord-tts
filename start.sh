#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "エラー: .env ファイルが見つかりません" >&2
  exit 1
fi

podman run --rm \
  --env-file "$SCRIPT_DIR/.env" \
  -v "$SCRIPT_DIR:/app:Z" \
  -w /app \
  node:24-slim \
  bash -c "apt-get update -qq && apt-get install -y -qq python3 make g++ ffmpeg > /dev/null 2>&1 && npm install --ignore-scripts && npm rebuild @discordjs/opus && npm run build && exec node dist/index.js"
