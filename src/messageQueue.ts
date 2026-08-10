// 値の準備（音声合成）と消費（再生）を分けることで、
// 消費中に次のタスクの準備を先行させられるようにする
type Prepare<T> = () => Promise<T>;

export interface MessageQueueHandlers<T> {
  consume: (guildId: string, value: T) => Promise<void>;
  // 準備は済んだが消費されずに破棄される値の後始末
  discard: (value: T) => void;
}

interface QueueEntry<T> {
  prepare: Prepare<T>;
  prepared?: Promise<T>;
  resolve: () => void;
  reject: (reason: Error) => void;
}

export class MessageQueue<T> {
  private queues = new Map<string, QueueEntry<T>[]>();
  private processing = new Map<string, boolean>();
  private handlers: MessageQueueHandlers<T>;
  private maxLength: number;

  constructor (handlers: MessageQueueHandlers<T>, maxLength = 20) {
    this.handlers = handlers;
    this.maxLength = maxLength;
  }

  enqueue (guildId: string, prepare: Prepare<T>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.queues.has(guildId)) {
        this.queues.set(guildId, []);
      }

      const queue = this.queues.get(guildId)!;
      queue.push({ prepare, resolve, reject });

      // 上限を超えた場合、先頭（古い方）を破棄
      while (queue.length > this.maxLength) {
        this.drop(queue.shift()!, 'キューの上限超過により破棄されました');
      }

      // 消費中に積まれた場合、この時点で次に消費される1件を準備しておく
      if (this.processing.get(guildId)) {
        this.start(queue[0]);
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
    const entries = queue.splice(0);
    for (const entry of entries) {
      this.drop(entry, 'キューがクリアされました');
    }
    return entries.length;
  }

  private drop (entry: QueueEntry<T>, reason: string): void {
    entry.reject(new Error(reason));
    if (entry.prepared) {
      // 先行して準備した値は消費されないので後始末する
      entry.prepared.then((value) => this.handlers.discard(value)).catch(() => {});
    }
  }

  private start (entry: QueueEntry<T>): Promise<T> {
    if (!entry.prepared) {
      entry.prepared = entry.prepare();
      // 破棄・失敗しても未処理の rejection にしない（消費時に改めて await する）
      entry.prepared.catch(() => {});
    }
    return entry.prepared;
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
    const prepared = this.start(entry);

    // 消費中に次の1件を準備しておき、準備待ちの間が空かないようにする
    if (queue.length > 0) {
      this.start(queue[0]);
    }

    try {
      await this.handlers.consume(guildId, await prepared);
    } catch (error) {
      console.error('キュータスク エラー:', error);
    }

    entry.resolve();
    this.processing.set(guildId, false);
    this.processNext(guildId);
  }
}
