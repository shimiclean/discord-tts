# Discord Voice TTS Bot

特定の Discord サーバーに常駐し、Voice チャンネルのテキストを読み上げる Bot。

## 機能

- 特定の Discord サーバーに接続して待機
- Voice チャンネルに誰かが参加すると Bot も同じ Voice チャンネルに参加（同一ギルドで既に接続中なら参加しない）
- Voice チャンネルのテキストチャット（GuildVoice）に投稿があると音声合成して同チャンネルで再生
- Voice チャンネルから Bot 以外の全員が退出したら Bot も退出
- ユーザーがチャンネル間を移動した場合、旧チャンネルの退出処理を先に行い、その後に新チャンネルへの参加判定を行う
- ユーザーが Voice チャンネルに参加したとき「{ユーザー名}が参加しました」と読み上げる
- ユーザーが Voice チャンネルから切断したとき「{ユーザー名}が切断しました」と読み上げる（Bot も退出する場合は読み上げない）
- 同一ギルド内のメッセージはキューで順次処理（異なるギルドは並行処理）

## 読み上げフォーマット

- 「{ユーザー名}、{本文}」の形式で読み上げる
- ユーザー名はサーバーニックネーム優先、なければ表示名を使用
- ユーザー名にも本文と同じサニタイズ（絵文字・メンション・URL 除去、空白正規化）を適用する
  - ニックネームがサニタイズ後に空になった場合は表示名にフォールバック
  - 両方空になった場合は名前なしで本文のみ読み上げる
- 本文の事前処理（この順序で適用）:
  1. Discord カスタム絵文字（`<:name:id>`, `<a:name:id>`）を削除
  2. Unicode 絵文字（修飾子・ZWJ シーケンス含む）を削除
  3. メンション（ユーザー `<@id>`、ロール `<@&id>`、チャンネル `<#id>`）を削除
  4. スキーム付き URL（`http://`, `https://`）を「URL」に置換（裸ドメインは対象外）
  5. 連続空白の正規化・前後トリム
- 事前処理後の本文が150文字を超える場合は150文字で切り取り「以下略」を付加
- 事前処理後の本文が空の場合は読み上げをスキップ

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

Voice チャンネルの内蔵テキストチャット（GuildVoice type=2）のメッセージを読み上げる。Bot が参加中のボイスチャンネルの ID と一致する場合のみ対象。

## 環境変数（.env）

- `DISCORD_TOKEN` - Discord Bot トークン
- `TTS_BASE_URL` - OpenAI 互換 TTS API の base URL
- `TTS_MODEL` - TTS モデル名
- `TTS_API_KEY` - TTS API キー
- `TTS_VOICE` - TTS 音声名（例: alloy）

## ツール

- `./start.sh` - Bot を起動する（.env ファイルが必要、コンテナ内で ffmpeg を自動インストール）
- `./invite.sh <クライアントID>` - Bot をサーバーに招待するための OAuth2 URL を生成する（権限: View Channels, Connect, Speak）

## 開発ルール

- TDD: 必ずテストコードを先に書いてから実装コードを書く
- テストは本質的なテストと境界値テストを含めること（形だけのテストは不可）
- TypeScript の実行（npm install、テスト、ビルド等）はすべて podman コンテナで行う
- `npm install` は @discordjs/opus のビルドに python3, make, g++ が必要（`apt-get install -y python3 make g++`）
- 実行時は ffmpeg が必要（`apt-get install -y ffmpeg`）
- Claude Code が .env ファイルを読み込むことは禁止（.env.example は可。Bot ランタイムの dotenv 使用は問題ない）
- コメントやテストの human-readable なテキストは英語で考えて日本語で記載する
- コーディングスタイル: semistandard（セミコロンあり、シングルクォート、インデント2スペース）
