const MAX_BODY_LENGTH = 150;

// Discord カスタム絵文字: <:name:id> または <a:name:id>
const CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/g;

// Unicode 絵文字（Emoji_Presentation + 修飾子 + ZWJ シーケンス）
const UNICODE_EMOJI_RE = /\p{Emoji_Presentation}[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}]?(\u{200D}\p{Emoji_Presentation}[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)*/gu;

// メンション: <@id>, <@!id>, <@&id>, <#id>
const MENTION_RE = /<@[!&]?\d+>|<#\d+>/g;

// URL（スキーム付きのみ）
const URL_RE = /https?:\/\/\S+/g;

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

export function formatTtsMessage (text: string, user: TtsUser, dict?: Dictionary, hasImage?: boolean): string {
  let body = text;

  // カスタム絵文字の削除
  body = body.replace(CUSTOM_EMOJI_RE, '');

  // Unicode 絵文字の削除
  body = body.replace(UNICODE_EMOJI_RE, '');

  // メンションの削除
  body = body.replace(MENTION_RE, '');

  // URL の置換
  body = body.replace(URL_RE, 'URL');

  // 空白の正規化
  body = body.replace(MULTI_SPACE_RE, ' ').trim();

  // 辞書置換
  if (dict) body = dict.apply(body);

  // 処理後に本文が空の場合
  if (body.length === 0) {
    if (hasImage) {
      body = '画像';
    } else {
      return '';
    }
  }

  // 文字数制限
  if (body.length > MAX_BODY_LENGTH) {
    body = body.slice(0, MAX_BODY_LENGTH) + '以下略';
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
