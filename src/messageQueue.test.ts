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
    for (let i = 0; i < 25; i++) {
      queue.enqueue('guild1', async () => { executed.push(i); });
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

  it('カスタム上限を設定できる', async () => {
    const customQueue = new MessageQueue(3);
    const executed: number[] = [];

    let resolveBlocker!: () => void;
    const blocker = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });
    customQueue.enqueue('guild1', () => blocker);

    for (let i = 0; i < 5; i++) {
      customQueue.enqueue('guild1', async () => { executed.push(i); });
    }

    resolveBlocker();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(executed).toEqual([2, 3, 4]);
  });
});
