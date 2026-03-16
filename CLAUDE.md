# Discord Voice TTS Bot

特定の Discord サーバーに常駐し、Voice チャンネルのテキストを読み上げる Bot。

## 機能

- 特定の Discord サーバーに接続して待機
- Voice チャンネルに誰かが参加すると Bot も同じ Voice チャンネルに参加
- 対応するテキストチャンネルに投稿があると音声合成して Voice チャンネルで再生
- Voice チャンネルから Bot 以外の全員が退出したら Bot も退出

## 技術スタック

- 言語: TypeScript
- パッケージマネージャ: npm
- テストフレームワーク: Jest
- TTS: OpenAI 互換 API
- Opus エンコード: @discordjs/opus（ネイティブビルド）
- Voice 暗号化: tweetnacl
- 音声変換: ffmpeg（コンテナ内に必要）
- 実行環境: podman + node:24-slim（開発・本番ともに。Dockerfile は使わない）

## チャンネル対応ルール

Voice チャンネルとテキストチャンネルは同名で紐付ける。

## 環境変数（.env）

- `DISCORD_TOKEN` - Discord Bot トークン
- `TTS_BASE_URL` - OpenAI 互換 TTS API の base URL
- `TTS_MODEL` - TTS モデル名
- `TTS_API_KEY` - TTS API キー
- `TTS_VOICE` - TTS 音声名（例: alloy）

## 開発ルール

- TDD: 必ずテストコードを先に書いてから実装コードを書く
- テストは本質的なテストと境界値テストを含めること（形だけのテストは不可）
- TypeScript の実行（npm install、テスト、ビルド等）はすべて podman コンテナで行う
- `npm install` は @discordjs/opus のビルドに python3, make, g++ が必要（`apt-get install -y python3 make g++`）
- 実行時は ffmpeg が必要（`apt-get install -y ffmpeg`）
- .env ファイルは読み込み禁止（.env.example は可）
- コメントやテストの human-readable なテキストは英語で考えて日本語で記載する
- コーディングスタイル: semistandard（セミコロンあり、シングルクォート、インデント2スペース）
