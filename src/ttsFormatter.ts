const MAX_BODY_LENGTH = 150;

// Discord カスタム絵文字: <:name:id> または <a:name:id>
const CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/g;

// Unicode 絵文字（Emoji_Presentation / VS16 付きテキスト絵文字 / キーキャップ + 修飾子 + ZWJ シーケンス）
const EMOJI_COMPONENT_RE = '(?:\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F)(?:[\\u{1F3FB}-\\u{1F3FF}]|\\u20E3)?';
const UNICODE_EMOJI_RE = new RegExp(`${EMOJI_COMPONENT_RE}(?:\\u200D${EMOJI_COMPONENT_RE})*`, 'gu');

// メンション: <@id>, <@!id>, <@&id>, <#id>
const MENTION_RE = /<@[!&]?\d+>|<#\d+>/g;

// URL（RFC 3986 準拠、IDN 非対応）
// unreserved / reserved / pct-encoded で構成される文字のみマッチ
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g;
// URL 末尾で文脈上の句読点として使われやすい文字を除去
const URL_TRAILING_RE = /[.),;:!?']+$/;

// 連続する空白
const MULTI_SPACE_RE = /\s{2,}/g;

import { Dictionary } from './dictionary';

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
    .replace(MULTI_SPACE_RE, ' ')
    .trim();
}

function resolveName (user: TtsUser, dict?: Dictionary): string {
  if (user.nickname !== null) {
    let cleaned = sanitize(user.nickname);
    if (dict) cleaned = dict.apply(cleaned);
    if (cleaned.length > 0) return cleaned;
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

export function formatTtsMessage (text: string, user: TtsUser, dict?: Dictionary, attachments?: AttachmentCounts, skipName?: boolean, imageSummary?: string): string {
  let body = text;

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
  body = body.replace(MULTI_SPACE_RE, ' ').trim();

  // 辞書置換
  if (dict) body = dict.apply(body);

  // 処理後に本文が空の場合
  if (body.length === 0) {
    if (imageSummary && imageSummary.length > 0) {
      body = `画像　概要：${imageSummary}`;
    } else {
      const label = attachments ? formatAttachmentLabel(attachments) : '';
      if (label.length > 0) {
        body = label;
      } else {
        return '';
      }
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

export function formatJoinMessage (user: TtsUser, model?: string, dict?: Dictionary): string {
  const suffix = model === 'zundamon' ? '参加したのだ' : '参加しました';
  return `${resolveName(user, dict)}が${suffix}`;
}

export function formatLeaveMessage (user: TtsUser, model?: string, dict?: Dictionary): string {
  const suffix = model === 'zundamon' ? '退出したのだ' : '退出しました';
  return `${resolveName(user, dict)}が${suffix}`;
}
