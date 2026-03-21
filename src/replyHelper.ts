import { Message } from 'discord.js';

const MAX_RETRIES = 3;

export async function withRetry (label: string, fn: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.warn(`${label} (${attempt}/${MAX_RETRIES}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

export function createTypingIndicator (channel: unknown): () => void {
  const sendTyping = () => {
    if (channel && typeof channel === 'object' && 'sendTyping' in channel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).sendTyping().catch(() => {});
    }
  };
  sendTyping();
  const interval = setInterval(sendTyping, 8_000);
  return () => clearInterval(interval);
}

export async function sendPlaceholder (message: Message, text: string): Promise<Message | null> {
  try {
    return await message.reply(text);
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
    await withRetry('リプライ送信エラー', () => message.reply(text));
  }
}

export async function deletePlaceholder (placeholder: Message | null): Promise<void> {
  if (placeholder) {
    await withRetry('プレースホルダー削除エラー', () => placeholder.delete());
  }
}
