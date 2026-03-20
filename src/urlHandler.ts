import { Message } from 'discord.js';
import { TtsVoiceConfig } from './speakerConfig';
import { downloadBuffer } from './downloader';
import { formatUrlSummary, formatUrlSummaryReply, formatImageSummary, formatImageSummaryReply } from './ttsFormatter';

const MAX_RETRIES = 3;

// eslint-disable-next-line no-useless-escape
const URL_RE = /^https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$/;

const SCRIPT_STYLE_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /[\n\r]+|\s{2,}/g;

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

function stripHtml (html: string): string {
  return html
    .replace(SCRIPT_STYLE_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim();
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
      let text = result.toString('utf-8');
      if (isHtmlContentType(result.contentType)) {
        text = stripHtml(text);
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
