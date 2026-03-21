import { Dictionary } from './dictionary';

const MAX_BODY_LENGTH = 150;

// コードブロック: ```lang?\n...\n``` （閉じていない場合も末尾まで含む）
const CODE_BLOCK_RE = /```[^\n]*\n[\s\S]*?(?:```|$)/g;

// インラインコード: `...`
const INLINE_CODE_RE = /`([^`]+)`/g;

// 複数行引用: >>> 以降全て
const MULTI_LINE_QUOTE_RE = /^>>>[ \t]?[\s\S]*$/m;

// 単一行引用: > で始まる連続行
const SINGLE_LINE_QUOTE_RE = /(?:^>[ \t]?.*$\n?)+/gm;

// Discord カスタム絵文字: <:name:id> または <a:name:id>
const CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/g;

// Unicode 絵文字（Emoji_Presentation / VS16 付きテキスト絵文字 / キーキャップ + 修飾子 + ZWJ シーケンス）
const EMOJI_COMPONENT_RE = '(?:\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F)(?:[\\u{1F3FB}-\\u{1F3FF}]|\\u20E3)?';
const UNICODE_EMOJI_RE = new RegExp(`${EMOJI_COMPONENT_RE}(?:\\u200D${EMOJI_COMPONENT_RE})*`, 'gu');

// メンション: <@id>, <@!id>, <@&id>, <#id>
const MENTION_RE = /<@[!&]?\d+>|<#\d+>/g;

// URL（RFC 3986 準拠、IDN 非対応）
// unreserved / reserved / pct-encoded で構成される文字のみマッチ
// eslint-disable-next-line no-useless-escape
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g;
// URL 末尾で文脈上の句読点として使われやすい文字を除去
const URL_TRAILING_RE = /[.),;:!?']+$/;

// 改行および連続する空白
const WHITESPACE_RE = /[\n\r]+|\s{2,}/g;

export interface TtsUser {
  nickname: string | null;
  displayName: string;
}

function sanitize (text: string): string {
  return text
    .replace(CUSTOM_EMOJI_RE, '')
    .replace(UNICODE_EMOJI_RE, '')
    .replace(MENTION_RE, '')
    .replace(URL_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim();
}

function resolveName (user: TtsUser, dict?: Dictionary): string {
  if (user.nickname !== null) {
    let cleaned = sanitize(user.nickname);
    if (dict) cleaned = dict.apply(cleaned);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  let cleaned = sanitize(user.displayName);
  if (dict) cleaned = dict.apply(cleaned);
  return cleaned;
}

export interface AttachmentCounts {
  image: number;
  video: number;
}

function formatAttachmentLabel (counts: AttachmentCounts): string {
  const mixed = counts.image > 0 && counts.video > 0;
  const parts: string[] = [];
  if (counts.image > 0) {
    parts.push((!mixed && counts.image === 1) ? '画像' : `画像${counts.image}枚`);
  }
  if (counts.video > 0) {
    parts.push((!mixed && counts.video === 1) ? '動画' : `動画${counts.video}本`);
  }
  return parts.join('・');
}

export function formatTtsMessage (text: string, user: TtsUser, dict?: Dictionary, attachments?: AttachmentCounts, skipName?: boolean): string {
  let body = text;

  // コードブロックを「コード省略」に置換
  body = body.replace(CODE_BLOCK_RE, 'コード省略');

  // インラインコードのバッククォートを除去（中身はそのまま）
  body = body.replace(INLINE_CODE_RE, '$1');

  // 複数行引用（>>>）を「引用省略」に置換
  body = body.replace(MULTI_LINE_QUOTE_RE, '引用省略');

  // 単一行引用（>）を「引用省略」に置換
  body = body.replace(SINGLE_LINE_QUOTE_RE, '引用省略\n');

  // カスタム絵文字の削除
  body = body.replace(CUSTOM_EMOJI_RE, '');

  // Unicode 絵文字の削除
  body = body.replace(UNICODE_EMOJI_RE, '');

  // メンションの削除
  body = body.replace(MENTION_RE, '');

  // URL の置換（末尾の句読点・括弧を保持）
  body = body.replace(URL_RE, (match) => {
    const trailing = match.match(URL_TRAILING_RE);
    return trailing ? 'URL' + trailing[0] : 'URL';
  });

  // 空白の正規化
  body = body.replace(WHITESPACE_RE, ' ').trim();

  // 辞書置換
  if (dict) body = dict.apply(body);

  // 処理後に本文が空の場合
  if (body.length === 0) {
    const label = attachments ? formatAttachmentLabel(attachments) : '';
    if (label.length > 0) {
      body = label;
    } else {
      return '';
    }
  }

  // 文字数制限
  if (body.length > MAX_BODY_LENGTH) {
    body = body.slice(0, MAX_BODY_LENGTH) + '以下略';
  }

  if (skipName) {
    return body;
  }
  const name = resolveName(user, dict);
  if (name.length === 0) {
    return body;
  }
  return `${name}、${body}`;
}

const MAX_REPLY_LENGTH = 500;

export function formatUrlSummary (summary: string): string {
  const body = `要約：${summary}`;
  if (body.length > MAX_BODY_LENGTH) {
    return body.slice(0, MAX_BODY_LENGTH) + '以下略';
  }
  return body;
}

export function formatUrlSummaryReply (summary: string): string {
  const body = `要約：${summary}`;
  if (body.length > MAX_REPLY_LENGTH) {
    return body.slice(0, MAX_REPLY_LENGTH);
  }
  return body;
}

export function formatImageSummary (summary: string): string {
  const body = `概要：${summary}`;
  if (body.length > MAX_BODY_LENGTH) {
    return body.slice(0, MAX_BODY_LENGTH) + '以下略';
  }
  return body;
}

export function formatImageSummaryReply (summary: string): string {
  const body = `概要：${summary}`;
  if (body.length > MAX_REPLY_LENGTH) {
    return body.slice(0, MAX_REPLY_LENGTH);
  }
  return body;
}

export function resolveReplyMention (text: string, userId: string, user: TtsUser): string {
  const name = resolveName(user);
  const pattern = new RegExp(`<@!?${userId}>`);
  if (name.length > 0) {
    return text.replace(pattern, `@${name}`);
  }
  return text.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
}

export type StateMessageType = 'join' | 'leave' | 'streamStart' | 'streamEnd' | 'cameraOn' | 'cameraOff';

const STATE_SUFFIXES: Record<StateMessageType, { default: string; zundamon: string }> = {
  join: { default: '参加しました', zundamon: '参加したのだ' },
  leave: { default: '退出しました', zundamon: '退出したのだ' },
  streamStart: { default: 'ライブ配信を開始しました', zundamon: 'ライブ配信を開始したのだ' },
  streamEnd: { default: 'ライブ配信を終了しました', zundamon: 'ライブ配信を終了したのだ' },
  cameraOn: { default: 'カメラをつけました', zundamon: 'カメラをつけたのだ' },
  cameraOff: { default: 'カメラを切りました', zundamon: 'カメラを切ったのだ' }
};

export function formatStateMessage (type: StateMessageType, user: TtsUser, model?: string, dict?: Dictionary): string {
  const suffixes = STATE_SUFFIXES[type];
  const suffix = model === 'zundamon' ? suffixes.zundamon : suffixes.default;
  return `${resolveName(user, dict)}が${suffix}`;
}
