# Discord Voice TTS Bot

Discord の Voice チャンネルに常駐し、テキストチャットの内容を音声合成で読み上げる Bot。

## 機能

- Voice チャンネルにユーザーが参加すると Bot も自動で参加
- Voice チャンネルの内蔵テキストチャットに投稿があると音声合成して読み上げ
- ユーザーの参加・退出を音声でアナウンス
- 全員が退出すると Bot も自動で退出
- 絵文字・メンション・URL などを除去してクリーンなテキストを読み上げ
- 同一ギルド内は順次処理、異なるギルドは並行処理

## 必要なもの

- [podman](https://podman.io/)
- Discord Bot トークン（[Developer Portal](https://discord.com/developers/applications) で取得）
- OpenAI 互換の TTS API

## セットアップ

### 1. 依存関係のインストール

```sh
podman run --rm -v "$(pwd):/app:Z" -w /app node:24-slim \
  bash -c "apt-get update -qq && apt-get install -y -qq python3 make g++ > /dev/null 2>&1 && npm install"
```

### 2. ビルド

```sh
podman run --rm -v "$(pwd):/app:Z" -w /app node:24-slim npm run build
```

### 3. 環境変数の設定

```sh
cp .env.example .env
```

`.env` を編集して以下を設定:

| 変数 | 説明 |
|---|---|
| `DISCORD_TOKEN` | Discord Bot トークン |
| `TTS_BASE_URL` | OpenAI 互換 TTS API の base URL |
| `TTS_MODEL` | TTS モデル名 |
| `TTS_API_KEY` | TTS API キー |
| `TTS_VOICE` | TTS 音声名（例: alloy） |

### 4. Discord Developer Portal の設定

- **Bot** タブで **Message Content Intent** を ON にする

### 5. Bot をサーバーに招待

```sh
./invite.sh <クライアントID>
```

出力された URL をブラウザで開いてサーバーに追加。

### 6. 起動

```sh
./start.sh
```

## テスト

```sh
podman run --rm -v "$(pwd):/app:Z" -w /app node:24-slim npx jest
```

## ライセンス

[MIT](LICENSE) - Copyright (c) 2026 AIZAWA Hina
