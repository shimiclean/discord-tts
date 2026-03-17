#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="discord-tts"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "エラー: .env ファイルが見つかりません" >&2
  exit 1
fi

if [ "${1:-}" != "--skip-build" ]; then
  "$SCRIPT_DIR/build.sh"
fi

CONFIG_DIR="$SCRIPT_DIR/config"
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_DIR/voice-members.log.yml" ]; then
  echo "{}" > "$CONFIG_DIR/voice-members.log.yml"
fi

exec podman run --rm \
  --env-file "$SCRIPT_DIR/.env" \
  -v "$CONFIG_DIR:/app/config:Z" \
  "$IMAGE_NAME"
