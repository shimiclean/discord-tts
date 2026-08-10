import { Message } from 'discord.js';
import { withRetry } from './retry';
import { summaryReplyTracker } from './summaryReplyTracker';

export function createTypingIndicator (channel: unknown): () => void {
  const sendTyping = () => {
    if (channel && typeof channel === 'object' && 'sendTyping' in channel) {
      (channel as any).sendTyping().catch(() => {});
    }
  };
  sendTyping();
  const interval = setInterval(sendTyping, 8_000);
  return () => clearInterval(interval);
}

// ギルド外（DM）のメッセージは削除追跡の対象外
function trackReply (message: Message, reply: Message): void {
  if (message.guildId) {
    summaryReplyTracker.track(message.guildId, message.id, reply);
  }
}

export async function sendPlaceholder (message: Message, text: string): Promise<Message | null> {
  try {
    const placeholder = await message.reply(text);
    trackReply(message, placeholder);
    return placeholder;
  } catch (e) {
    console.warn(`プレースホルダー送信エラー: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

export async function editPlaceholder (
  placeholder: Message | null,
  message: Message,
  text: string
): Promise<void> {
  if (placeholder) {
    await withRetry('プレースホルダー編集エラー', () => placeholder.edit(text));
  } else {
    await withRetry('リプライ送信エラー', async () => {
      const reply = await message.reply(text);
      trackReply(message, reply);
    });
  }
}

export async function deletePlaceholder (placeholder: Message | null): Promise<void> {
  if (placeholder) {
    summaryReplyTracker.untrack(placeholder);
    await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
  }
}
