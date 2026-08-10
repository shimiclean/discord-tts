import { Message } from 'discord.js';
import { withRetry } from './retry';

// ギルドごとに追跡するリプライ数の上限（古い追跡から破棄）
export const MAX_TRACKED_REPLIES = 200;

// 要約・概要のリプライを元メッセージIDに紐付けてギルドごとに保持し、
// 元メッセージが削除されたときに一緒に削除できるようにする
export class SummaryReplyTracker {
  private readonly guilds = new Map<string, Map<string, Message>>();

  track (guildId: string, originalMessageId: string, reply: Message): void {
    let replies = this.guilds.get(guildId);
    if (!replies) {
      replies = new Map();
      this.guilds.set(guildId, replies);
    }
    replies.delete(originalMessageId);
    replies.set(originalMessageId, reply);
    while (replies.size > MAX_TRACKED_REPLIES) {
      const oldest = replies.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      replies.delete(oldest);
    }
  }

  untrack (reply: Message): void {
    for (const [guildId, replies] of this.guilds) {
      for (const [originalMessageId, tracked] of replies) {
        if (tracked === reply) {
          this.forget(guildId, replies, originalMessageId);
          return;
        }
      }
    }
  }

  async handleDelete (guildId: string, originalMessageId: string): Promise<void> {
    const replies = this.guilds.get(guildId);
    const reply = replies?.get(originalMessageId);
    if (!replies || !reply) {
      return;
    }
    this.forget(guildId, replies, originalMessageId);
    await withRetry('要約リプライ削除エラー', () => reply.delete());
  }

  private forget (guildId: string, replies: Map<string, Message>, originalMessageId: string): void {
    replies.delete(originalMessageId);
    if (replies.size === 0) {
      this.guilds.delete(guildId);
    }
  }
}

export const summaryReplyTracker = new SummaryReplyTracker();
