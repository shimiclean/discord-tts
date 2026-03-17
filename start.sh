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

MOUNT_OPTS=()
if [ -f "$SCRIPT_DIR/channels.yml" ]; then
  MOUNT_OPTS+=(-v "$SCRIPT_DIR/channels.yml:/app/channels.yml:ro,Z")
fi
if [ -f "$SCRIPT_DIR/dictionary.yml" ]; then
  MOUNT_OPTS+=(-v "$SCRIPT_DIR/dictionary.yml:/app/dictionary.yml:ro,Z")
fi
if [ -f "$SCRIPT_DIR/speakers.yml" ]; then
  MOUNT_OPTS+=(-v "$SCRIPT_DIR/speakers.yml:/app/speakers.yml:ro,Z")
fi

exec podman run --rm \
  --env-file "$SCRIPT_DIR/.env" \
  "${MOUNT_OPTS[@]}" \
  "$IMAGE_NAME"
