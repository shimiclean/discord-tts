#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="discord-tts"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "エラー: .env ファイルが見つかりません" >&2
  exit 1
fi

echo "イメージをビルド中..."
podman build -t "$IMAGE_NAME" "$SCRIPT_DIR"

MOUNT_OPTS=()
if [ -f "$SCRIPT_DIR/channels.yml" ]; then
  MOUNT_OPTS+=(-v "$SCRIPT_DIR/channels.yml:/app/channels.yml:ro,Z")
fi
if [ -f "$SCRIPT_DIR/dictionary.yml" ]; then
  MOUNT_OPTS+=(-v "$SCRIPT_DIR/dictionary.yml:/app/dictionary.yml:ro,Z")
fi

podman run --rm \
  --env-file "$SCRIPT_DIR/.env" \
  "${MOUNT_OPTS[@]}" \
  "$IMAGE_NAME"
