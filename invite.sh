#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "使い方: $0 <クライアントID>" >&2
  exit 1
fi

podman run --rm -v "$(cd "$(dirname "$0")" && pwd):/app:Z" -w /app node:24-slim node dist/invite.js "$1"
