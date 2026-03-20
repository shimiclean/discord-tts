import { Message } from 'discord.js';
import { TtsVoiceConfig } from './speakerConfig';
import { downloadBuffer } from './downloader';
import { formatUrlSummary, formatUrlSummaryReply, formatImageSummary, formatImageSummaryReply } from './ttsFormatter';

const MAX_RETRIES = 3;

// eslint-disable-next-line no-useless-escape
const URL_RE = /^https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$/;

const CHARSET_FROM_CT_RE = /charset\s*=\s*["']?([^\s;"']+)/i;
const META_CHARSET_RE = /<meta\s[^>]*charset\s*=\s*["']?([^\s;"'>]+)/i;
const META_HTTP_EQUIV_CHARSET_RE = /<meta\s[^>]*http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset=([^\s;"']+)/i;

const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /[\n\r]+|\s{2,}/g;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_DESC_RE = /<meta\s+(?:[^>]*?\s)?(?:name|property)\s*=\s*["']([^"']*)["'][^>]*?\scontent\s*=\s*["']([^"']*)["'][^>]*?>|<meta\s+(?:[^>]*?\s)?content\s*=\s*["']([^"']*)["'][^>]*?\s(?:name|property)\s*=\s*["']([^"']*)["'][^>]*?>/gi;

async function withRetry (label: string, fn: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.warn(`URL要約: ${label} (${attempt}/${MAX_RETRIES}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

function isTextContentType (contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return ct.startsWith('text/');
}

function isHtmlContentType (contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return ct === 'text/html';
}

function extractHtmlHints (html: string): string[] {
  const hints: string[] = [];
  const titleMatch = html.match(TITLE_RE);
  if (titleMatch && titleMatch[1].trim()) {
    hints.push(`タイトル: ${titleMatch[1].trim()}`);
  }
  let match;
  META_DESC_RE.lastIndex = 0;
  while ((match = META_DESC_RE.exec(html)) !== null) {
    // パターン1: name/property が先、content が後
    const nameOrProp = match[1] ?? match[4];
    const content = match[2] ?? match[3];
    if (nameOrProp && content && /^(description|og:description)$/i.test(nameOrProp)) {
      hints.push(`説明: ${content}`);
    }
  }
  return hints;
}

function stripHtml (html: string): string {
  return html
    .replace(SCRIPT_STYLE_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim();
}

function parseHtml (html: string): string {
  const hints = extractHtmlHints(html);
  const body = stripHtml(html);
  if (hints.length === 0) {
    return body;
  }
  return hints.join('\n') + '\n\n' + body;
}

function detectCharset (contentType: string, buffer: Buffer, isHtml: boolean): string {
  // Content-Type ヘッダーの charset を優先
  const ctMatch = contentType.match(CHARSET_FROM_CT_RE);
  if (ctMatch) {
    return ctMatch[1];
  }

  // HTML の場合はメタタグから検出
  if (isHtml) {
    // ASCII 部分だけを読めれば十分なので latin1 で仮デコード
    const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
    const metaMatch = head.match(META_CHARSET_RE) ?? head.match(META_HTTP_EQUIV_CHARSET_RE);
    if (metaMatch) {
      return metaMatch[1];
    }
  }

  return 'utf-8';
}

function decodeBuffer (buffer: Buffer, contentType: string, isHtml: boolean): string {
  const charset = detectCharset(contentType, buffer, isHtml);
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    // サポートされていないエンコーディングの場合は UTF-8 にフォールバック
    return new TextDecoder('utf-8').decode(buffer);
  }
}

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff'
]);

function toFetchUrl (url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'x.com' || host === 'www.x.com' ||
        host === 'twitter.com' || host === 'www.twitter.com' ||
        host === 'mobile.twitter.com') {
      parsed.hostname = 'fxtwitter.com';
      return parsed.toString();
    }
  } catch {
    // URL パース失敗時はそのまま返す
  }
  return url;
}

function isSupportedImageType (contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return SUPPORTED_IMAGE_TYPES.has(ct);
}

export interface UrlSummaryOptions {
  chatMultiModal: boolean;
  userVoice: TtsVoiceConfig;
  enqueueTts: (guildId: string, text: string, voice: TtsVoiceConfig) => void;
  summarizeUrl: (text: string) => Promise<string>;
  processImage: (url: string) => Promise<string>;
  describeImage: (dataUri: string) => Promise<string>;
}

export async function handleUrlSummary (message: Message, options: UrlSummaryOptions): Promise<void> {
  const trimmed = message.content.trim();
  if (!URL_RE.test(trimmed)) {
    return;
  }

  const url = trimmed;
  const fetchUrl = toFetchUrl(url);
  console.log(`URL要約: ダウンロード開始 url=${url}${fetchUrl !== url ? ` -> ${fetchUrl}` : ''}`);

  const sendTyping = () => {
    if ('sendTyping' in message.channel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (message.channel as any).sendTyping().catch(() => {});
    }
  };
  sendTyping();
  const typingInterval = setInterval(sendTyping, 8_000);

  const placeholderPromise = message.reply('要約：解析中...').catch((e) => {
    console.warn(`URL要約: プレースホルダー送信エラー: ${e instanceof Error ? e.message : e}`);
    return null;
  });

  try {
    const result = await downloadBuffer(fetchUrl);

    if (isTextContentType(result.contentType)) {
      const html = isHtmlContentType(result.contentType);
      let text = decodeBuffer(result, result.contentType, html);
      if (html) {
        text = parseHtml(text);
      }

      console.log(`URL要約: 要約API送信中... (${text.length}文字)`);
      const summary = await options.summarizeUrl(text);
      console.log(`URL要約: 受信した要約 "${summary}"`);

      const placeholder = await placeholderPromise;

      if (summary.length > 0) {
        options.enqueueTts(message.guild!.id, formatUrlSummary(summary), options.userVoice);
        if (placeholder) {
          await withRetry('プレースホルダー編集エラー', () => placeholder.edit(formatUrlSummaryReply(summary)));
        } else {
          await withRetry('リプライ送信エラー', () => message.reply(formatUrlSummaryReply(summary)));
        }
      } else {
        if (placeholder) {
          await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
        }
      }
      return;
    }

    if (options.chatMultiModal && isSupportedImageType(result.contentType) && result.length <= MAX_IMAGE_SIZE) {
      console.log(`URL要約: 画像解析開始 contentType=${result.contentType} size=${result.length}`);
      const dataUri = await options.processImage(fetchUrl);
      const summary = await options.describeImage(dataUri);
      console.log(`URL要約: 受信した概要 "${summary}"`);

      const placeholder = await placeholderPromise;

      if (summary.length > 0) {
        options.enqueueTts(message.guild!.id, formatImageSummary(summary), options.userVoice);
        if (placeholder) {
          await withRetry('プレースホルダー編集エラー', () => placeholder.edit(formatImageSummaryReply(summary)));
        } else {
          await withRetry('リプライ送信エラー', () => message.reply(formatImageSummaryReply(summary)));
        }
      } else {
        if (placeholder) {
          await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
        }
      }
      return;
    }

    console.log(`URL要約: 処理対象外のためスキップ contentType=${result.contentType}`);
    const placeholder = await placeholderPromise;
    if (placeholder) {
      await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
    }
  } catch (e) {
    console.warn(`URL要約: エラー: ${e instanceof Error ? e.message : e}`);
    const placeholder = await placeholderPromise;
    if (placeholder) {
      await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
    }
  } finally {
    clearInterval(typingInterval);
  }
}
