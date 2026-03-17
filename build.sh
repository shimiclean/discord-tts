#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="discord-tts"

echo "イメージをビルド中..."
podman build -t "$IMAGE_NAME" "$SCRIPT_DIR"
echo "ビルド完了: $IMAGE_NAME"
