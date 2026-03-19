import { Message } from 'discord.js';
import { TtsVoiceConfig } from './speakerConfig';
import { formatImageSummary, formatImageSummaryReply } from './ttsFormatter';

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_RETRIES = 3;

async function withRetry (label: string, fn: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.warn(`画像概要: ${label} (${attempt}/${MAX_RETRIES}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

export interface ImageSummaryOptions {
  chatMultiModal: boolean;
  imageCount: number;
  videoCount: number;
  userVoice: TtsVoiceConfig;
  enqueueTts: (guildId: string, text: string, voice: TtsVoiceConfig) => void;
  processImage: (url: string) => Promise<string>;
  describeImage: (dataUri: string) => Promise<string>;
}

export async function handleImageSummary (message: Message, options: ImageSummaryOptions): Promise<void> {
  if (
    !options.chatMultiModal ||
    message.content.trim() !== '' ||
    options.imageCount !== 1 ||
    options.videoCount !== 0
  ) {
    return;
  }

  const attachment = message.attachments.first()!;
  console.log(`画像概要: 添付ファイル size=${attachment.size} bytes, contentType=${attachment.contentType}, url=${attachment.url}`);
  if (attachment.size > MAX_IMAGE_SIZE) {
    console.log(`画像概要: サイズ超過のためスキップ (${attachment.size} bytes > ${MAX_IMAGE_SIZE} bytes)`);
    return;
  }

  const sendTyping = () => {
    if ('sendTyping' in message.channel) {
      (message.channel as any).sendTyping().catch(() => {});
    }
  };
  sendTyping();
  const typingInterval = setInterval(sendTyping, 8_000);

  // プレースホルダーと画像変換を並行して開始
  const placeholderPromise = message.reply('概要：画像解析中...').catch((e) => {
    console.warn(`画像概要: プレースホルダー送信エラー: ${e instanceof Error ? e.message : e}`);
    return null;
  });

  try {
    console.log('画像概要: 画像を変換中...');
    const dataUri = await options.processImage(attachment.url);

    console.log('画像概要: Chat API に送信中...');
    const summary = await options.describeImage(dataUri);
    console.log(`画像概要: 受信した概要 "${summary}"`);

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
  } catch (e) {
    console.warn(`画像概要: エラー: ${e instanceof Error ? e.message : e}`);
    const placeholder = await placeholderPromise;
    if (placeholder) {
      await withRetry('プレースホルダー編集エラー', () => placeholder.edit('解析エラー'));
    }
  } finally {
    clearInterval(typingInterval);
  }
}
