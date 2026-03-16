type Task = () => Promise<void>;

interface QueueEntry {
  task: Task;
  resolve: () => void;
}

export class MessageQueue {
  private queues = new Map<string, QueueEntry[]>();
  private processing = new Map<string, boolean>();
  private maxLength: number;

  constructor (maxLength = 20) {
    this.maxLength = maxLength;
  }

  enqueue (guildId: string, task: Task): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }

      const queue = this.queues.get(guildId)!;
      queue.push({ task, resolve });

      // 上限を超えた場合、先頭（古い方）を破棄
      while (queue.length > this.maxLength) {
        const discarded = queue.shift()!;
        discarded.resolve();
      }

      this.processNext(guildId);
    });
  }

  private async processNext (guildId: string): Promise<void> {
    if (this.processing.get(guildId)) return;

    const queue = this.queues.get(guildId);
    if (!queue || queue.length === 0) return;

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
