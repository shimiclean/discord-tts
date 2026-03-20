import { MessageQueue } from './messageQueue';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('タスクを順番に実行する', async () => {
    const order: number[] = [];

    const task1 = () => new Promise<void>((resolve) => {
      setTimeout(() => { order.push(1); resolve(); }, 30);
    });
    const task2 = () => new Promise<void>((resolve) => {
      setTimeout(() => { order.push(2); resolve(); }, 10);
    });
    const task3 = () => new Promise<void>((resolve) => {
      order.push(3); resolve();
    });

    const p1 = queue.enqueue('guild1', task1);
    const p2 = queue.enqueue('guild1', task2);
    const p3 = queue.enqueue('guild1', task3);

    await Promise.all([p1, p2, p3]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('異なるギルドのタスクは並行して実行される', async () => {
    const order: string[] = [];

    const slowTask = () => new Promise<void>((resolve) => {
      setTimeout(() => { order.push('guildA'); resolve(); }, 50);
    });
    const fastTask = () => new Promise<void>((resolve) => {
      setTimeout(() => { order.push('guildB'); resolve(); }, 10);
    });

    const pA = queue.enqueue('guildA', slowTask);
    const pB = queue.enqueue('guildB', fastTask);

    await Promise.all([pA, pB]);

    expect(order).toEqual(['guildB', 'guildA']);
  });

  it('タスクが失敗しても後続のタスクは実行される', async () => {
    const executed: number[] = [];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const failingTask = () => Promise.reject(new Error('テスト用エラー'));
    const normalTask = () => new Promise<void>((resolve) => {
      executed.push(2); resolve();
    });

    const p1 = queue.enqueue('guild1', failingTask);
    const p2 = queue.enqueue('guild1', normalTask);

    await Promise.all([p1, p2]);

    expect(executed).toEqual([2]);
    expect(errorSpy).toHaveBeenCalledWith(
      'キュータスク エラー:',
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });

  it('空のキューにタスクを追加すると即座に実行が開始される', async () => {
    let executed = false;

    await queue.enqueue('guild1', async () => {
      executed = true;
    });

    expect(executed).toBe(true);
  });

  it('キューの長さが上限を超えた場合、古いタスクが破棄される', async () => {
    const executed: number[] = [];

    // 最初のタスクは長時間ブロックする
    let resolveBlocker!: () => void;
    const blocker = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });
    queue.enqueue('guild1', () => blocker);

    // 上限を超えるタスクをキューに追加（上限はデフォルト20）
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 25; i++) {
      promises.push(queue.enqueue('guild1', async () => { executed.push(i); }));
    }

    // 破棄されたタスクのrejectを処理する
    for (let i = 0; i < 5; i++) {
      await expect(promises[i]).rejects.toThrow();
    }

    // ブロッカーを解放
    resolveBlocker();

    // すべての残りのタスクが完了するのを待つ
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    // 最初の5つが破棄され、後の20が実行される
    expect(executed).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 5)
    );
  });

  it('キューの上限超過で破棄されたタスクはrejectされる', async () => {
    const customQueue = new MessageQueue(2);

    let resolveBlocker!: () => void;
    const blocker = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });
    customQueue.enqueue('guild1', () => blocker);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < 4; i++) {
      promises.push(customQueue.enqueue('guild1', async () => {}));
    }

    // 最初の2つが破棄されるはず
    await expect(promises[0]).rejects.toThrow('キューの上限超過により破棄されました');
    await expect(promises[1]).rejects.toThrow('キューの上限超過により破棄されました');

    resolveBlocker();
    // 残りは正常に完了
    await expect(promises[2]).resolves.toBeUndefined();
    await expect(promises[3]).resolves.toBeUndefined();
  });

  describe('size', () => {
    it('待機中のタスク数を返す（実行中のタスクは含まない）', async () => {
      let resolveBlocker!: () => void;
      const blocker = new Promise<void>((resolve) => {
        resolveBlocker = resolve;
      });

      expect(queue.size('guild1')).toBe(0);

      queue.enqueue('guild1', () => blocker);
      expect(queue.size('guild1')).toBe(0); // 実行中なのでキューは空

      queue.enqueue('guild1', async () => {});
      queue.enqueue('guild1', async () => {});
      expect(queue.size('guild1')).toBe(2);

      resolveBlocker();
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      expect(queue.size('guild1')).toBe(0);
    });

    it('存在しないギルドIDに対して0を返す', () => {
      expect(queue.size('unknown')).toBe(0);
    });
  });

  describe('clear', () => {
    it('待機中のタスクをすべて破棄し破棄件数を返す', async () => {
      let resolveBlocker!: () => void;
      const blocker = new Promise<void>((resolve) => {
        resolveBlocker = resolve;
      });
      queue.enqueue('guild1', () => blocker);

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 3; i++) {
        promises.push(queue.enqueue('guild1', async () => {}));
      }

      const cleared = queue.clear('guild1');
      expect(cleared).toBe(3);
      expect(queue.size('guild1')).toBe(0);

      // 破棄されたタスクはrejectされる
      for (const p of promises) {
        await expect(p).rejects.toThrow();
      }

      resolveBlocker();
    });

    it('実行中のタスクには影響しない', async () => {
      let executed = false;
      let resolveBlocker!: () => void;
      const blocker = new Promise<void>((resolve) => {
        resolveBlocker = resolve;
      });
      const p = queue.enqueue('guild1', async () => {
        await blocker;
        executed = true;
      });

      queue.clear('guild1');
      resolveBlocker();
      await p;
      expect(executed).toBe(true);
    });

    it('存在しないギルドIDに対して0を返す', () => {
      expect(queue.clear('unknown')).toBe(0);
    });
  });

  it('カスタム上限を設定できる', async () => {
    const customQueue = new MessageQueue(3);
    const executed: number[] = [];

    let resolveBlocker!: () => void;
    const blocker = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });
    customQueue.enqueue('guild1', () => blocker);

    const promises: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      promises.push(customQueue.enqueue('guild1', async () => { executed.push(i); }));
    }

    // 破棄されたタスクのrejectを処理する
    for (let i = 0; i < 2; i++) {
      await expect(promises[i]).rejects.toThrow();
    }

    resolveBlocker();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(executed).toEqual([2, 3, 4]);
  });
});
