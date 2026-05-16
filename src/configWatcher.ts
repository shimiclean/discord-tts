import * as fs from 'fs';

export class ConfigWatcher {
  private watcher: fs.FSWatcher | null;
  private readonly handlers = new Map<string, () => void>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly debounceMs: number;

  constructor (dirPath: string, debounceMs: number = 200) {
    this.debounceMs = debounceMs;
    this.watcher = fs.watch(dirPath, (_eventType, filename) => {
      if (typeof filename === 'string' && this.handlers.has(filename)) {
        this.debounce(filename);
      }
    });
  }

  on (filename: string, callback: () => void): void {
    this.handlers.set(filename, callback);
  }

  close (): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private debounce (filename: string): void {
    const existing = this.timers.get(filename);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(filename, setTimeout(() => {
      this.timers.delete(filename);
      this.handlers.get(filename)?.();
    }, this.debounceMs));
  }
}
