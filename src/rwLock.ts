export class RWLock {
  private readers = 0;
  private writer = false;
  private waiters: Array<() => void> = [];

  private notify (): void {
    const queue = this.waiters;
    this.waiters = [];
    for (const resolve of queue) {
      resolve();
    }
  }

  private async waitUntil (condition: () => boolean): Promise<void> {
    while (!condition()) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  withReadLockSync<T> (fn: () => T): T {
    if (this.writer) {
      throw new Error('書き込みロック中のため読み取りロックを取得できません');
    }
    this.readers++;
    try {
      return fn();
    } finally {
      this.readers--;
      this.notify();
    }
  }

  withWriteLockSync<T> (fn: () => T): T {
    if (this.writer || this.readers > 0) {
      throw new Error('ロック中のため書き込みロックを取得できません');
    }
    this.writer = true;
    try {
      return fn();
    } finally {
      this.writer = false;
      this.notify();
    }
  }

  async withReadLock<T> (fn: () => T | Promise<T>): Promise<T> {
    await this.waitUntil(() => !this.writer);
    this.readers++;
    try {
      return await fn();
    } finally {
      this.readers--;
      this.notify();
    }
  }

  async withWriteLock<T> (fn: () => T | Promise<T>): Promise<T> {
    await this.waitUntil(() => !this.writer && this.readers === 0);
    this.writer = true;
    try {
      return await fn();
    } finally {
      this.writer = false;
      this.notify();
    }
  }
}
