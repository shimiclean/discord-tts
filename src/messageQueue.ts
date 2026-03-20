type Task = () => Promise<void>;

interface QueueEntry {
  task: Task;
  resolve: () => void;
  reject: (reason: Error) => void;
}

export class MessageQueue {
  private queues = new Map<string, QueueEntry[]>();
  private processing = new Map<string, boolean>();
  private maxLength: number;

  constructor (maxLength = 20) {
    this.maxLength = maxLength;
  }

  enqueue (guildId: string, task: Task): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }

      const queue = this.queues.get(guildId)!;
      queue.push({ task, resolve, reject });

      // 上限を超えた場合、先頭（古い方）を破棄
      while (queue.length > this.maxLength) {
        const discarded = queue.shift()!;
        discarded.reject(new Error('キューの上限超過により破棄されました'));
      }

      this.processNext(guildId);
    });
  }

  size (guildId: string): number {
    return this.queues.get(guildId)?.length ?? 0;
  }

  clear (guildId: string): number {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return 0;
    }
    const count = queue.length;
    const entries = queue.splice(0);
    for (const entry of entries) {
      entry.reject(new Error('キューがクリアされました'));
    }
    return count;
  }

  private async processNext (guildId: string): Promise<void> {
    if (this.processing.get(guildId)) {
      return;
    }

    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.processing.set(guildId, true);
    const entry = queue.shift()!;

    try {
      await entry.task();
    } catch (error) {
      console.error('キュータスク エラー:', error);
    }

    entry.resolve();
    this.processing.set(guildId, false);
    this.processNext(guildId);
  }
}
