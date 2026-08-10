import { MessageQueue } from './messageQueue';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

function blocker () {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe('MessageQueue', () => {
  let consumed: string[];
  let discarded: string[];
  let queue: MessageQueue<string>;

  beforeEach(() => {
    consumed = [];
    discarded = [];
    queue = new MessageQueue<string>({
      consume: async (_guildId, value) => { consumed.push(value); },
      discard: (value) => { discarded.push(value); }
    });
  });

  // 指定した値を返すだけの準備関数
  const prepare = (value: string) => () => Promise.resolve(value);

  it('準備した値を順番に消費する', async () => {
    const p1 = queue.enqueue('guild1', () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('1'), 30);
    }));
    const p2 = queue.enqueue('guild1', () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('2'), 10);
    }));
    const p3 = queue.enqueue('guild1', prepare('3'));

    await Promise.all([p1, p2, p3]);

    expect(consumed).toEqual(['1', '2', '3']);
  });

  it('異なるギルドのタスクは並行して処理される', async () => {
    const order: string[] = [];
    const parallelQueue = new MessageQueue<string>({
      consume: async (guildId) => { order.push(guildId); },
      discard: () => {}
    });

    const pA = parallelQueue.enqueue('guildA', () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('a'), 50);
    }));
    const pB = parallelQueue.enqueue('guildB', () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('b'), 10);
    }));

    await Promise.all([pA, pB]);

    expect(order).toEqual(['guildB', 'guildA']);
  });

  it('準備が失敗しても後続のタスクは処理される', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const p1 = queue.enqueue('guild1', () => Promise.reject(new Error('準備エラー')));
    const p2 = queue.enqueue('guild1', prepare('2'));

    await Promise.all([p1, p2]);

    expect(consumed).toEqual(['2']);
    expect(errorSpy).toHaveBeenCalledWith('キュータスク エラー:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('消費が失敗しても後続のタスクは処理される', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const failingQueue = new MessageQueue<string>({
      consume: async (_guildId, value) => {
        if (value === '1') {
          throw new Error('消費エラー');
        }
        consumed.push(value);
      },
      discard: () => {}
    });

    const p1 = failingQueue.enqueue('guild1', prepare('1'));
    const p2 = failingQueue.enqueue('guild1', prepare('2'));

    await Promise.all([p1, p2]);

    expect(consumed).toEqual(['2']);
    expect(errorSpy).toHaveBeenCalledWith('キュータスク エラー:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('空のキューにタスクを追加すると即座に処理が開始される', async () => {
    await queue.enqueue('guild1', prepare('1'));
    expect(consumed).toEqual(['1']);
  });

  describe('先読み', () => {
    it('消費中に次のタスクの準備を先行して開始する', async () => {
      const started: string[] = [];
      const block = blocker();
      const prefetchQueue = new MessageQueue<string>({
        consume: async (_guildId, value) => {
          consumed.push(value);
          if (value === '1') {
            await block.promise;
          }
        },
        discard: () => {}
      });
      const tracked = (value: string) => async () => {
        started.push(value);
        return value;
      };

      prefetchQueue.enqueue('guild1', tracked('1'));
      prefetchQueue.enqueue('guild1', tracked('2'));
      const p3 = prefetchQueue.enqueue('guild1', tracked('3'));

      await tick();
      // 1 を消費している間に 2 の準備が始まっている
      expect(consumed).toEqual(['1']);
      expect(started).toEqual(['1', '2']);

      block.release();
      await p3;
      expect(consumed).toEqual(['1', '2', '3']);
      expect(started).toEqual(['1', '2', '3']);
    });

    it('先行して準備するのは次の1件だけ', async () => {
      const started: string[] = [];
      const block = blocker();
      const prefetchQueue = new MessageQueue<string>({
        consume: async () => { await block.promise; },
        discard: () => {}
      });
      const tracked = (value: string) => async () => {
        started.push(value);
        return value;
      };

      for (const v of ['1', '2', '3', '4', '5']) {
        prefetchQueue.enqueue('guild1', tracked(v));
      }

      await tick();
      expect(started).toEqual(['1', '2']);

      block.release();
      await tick();
      expect(started).toEqual(['1', '2', '3', '4', '5']);
    });

    it('先行して準備済みのタスクを再度準備しない', async () => {
      const block = blocker();
      const prepareFn = jest.fn(() => Promise.resolve('2'));
      const prefetchQueue = new MessageQueue<string>({
        consume: async (_guildId, value) => {
          consumed.push(value);
          if (value === '1') {
            await block.promise;
          }
        },
        discard: () => {}
      });

      prefetchQueue.enqueue('guild1', prepare('1'));
      const p2 = prefetchQueue.enqueue('guild1', prepareFn);

      await tick();
      block.release();
      await p2;

      expect(prepareFn).toHaveBeenCalledTimes(1);
      expect(consumed).toEqual(['1', '2']);
    });

    it('先行して準備したタスクが失敗しても後続は処理される', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const block = blocker();
      const prefetchQueue = new MessageQueue<string>({
        consume: async (_guildId, value) => {
          consumed.push(value);
          if (value === '1') {
            await block.promise;
          }
        },
        discard: () => {}
      });

      prefetchQueue.enqueue('guild1', prepare('1'));
      prefetchQueue.enqueue('guild1', () => Promise.reject(new Error('準備エラー')));
      const p3 = prefetchQueue.enqueue('guild1', prepare('3'));

      await tick();
      block.release();
      await p3;

      expect(consumed).toEqual(['1', '3']);
      expect(errorSpy).toHaveBeenCalledWith('キュータスク エラー:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('破棄', () => {
    it('キューの長さが上限を超えた場合、古いタスクが破棄される', async () => {
      const block = blocker();
      queue.enqueue('guild1', async () => { await block.promise; return 'blocker'; });

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 25; i++) {
        promises.push(queue.enqueue('guild1', prepare(String(i))));
      }

      for (let i = 0; i < 5; i++) {
        await expect(promises[i]).rejects.toThrow();
      }

      block.release();
      await tick();

      // 最初の5つが破棄され、後の20が消費される
      expect(consumed).toEqual(['blocker', ...Array.from({ length: 20 }, (_, i) => String(i + 5))]);
    });

    it('キューの上限超過で破棄されたタスクはrejectされる', async () => {
      const limited = new MessageQueue<string>({
        consume: async () => {},
        discard: () => {}
      }, 2);

      const block = blocker();
      limited.enqueue('guild1', async () => { await block.promise; return 'blocker'; });

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 4; i++) {
        promises.push(limited.enqueue('guild1', prepare(String(i))));
      }

      await expect(promises[0]).rejects.toThrow('キューの上限超過により破棄されました');
      await expect(promises[1]).rejects.toThrow('キューの上限超過により破棄されました');

      block.release();
      await expect(promises[2]).resolves.toBeUndefined();
      await expect(promises[3]).resolves.toBeUndefined();
    });

    it('上限超過で破棄された準備済みの値は後始末される', async () => {
      const limited = new MessageQueue<string>({
        consume: async (_guildId, value) => {
          consumed.push(value);
          if (value === 'blocker') {
            await block.promise;
          }
        },
        discard: (value) => { discarded.push(value); }
      }, 2);
      const block = blocker();

      limited.enqueue('guild1', prepare('blocker'));
      // 先読みされる 1 件目を含め、上限超過で押し出す
      const dropped = limited.enqueue('guild1', prepare('prefetched'));
      limited.enqueue('guild1', prepare('a'));
      limited.enqueue('guild1', prepare('b'));

      await expect(dropped).rejects.toThrow('キューの上限超過により破棄されました');
      await tick();

      // 先読み済みだった値は消費されずに後始末される
      expect(discarded).toEqual(['prefetched']);
      expect(consumed).not.toContain('prefetched');

      block.release();
      await tick();
    });

    it('準備が始まっていないタスクは後始末されない', async () => {
      const block = blocker();
      queue.enqueue('guild1', async () => { await block.promise; return 'blocker'; });
      queue.enqueue('guild1', prepare('prefetched')).catch(() => {});
      queue.enqueue('guild1', prepare('untouched')).catch(() => {});

      await tick();
      queue.clear('guild1');
      await tick();

      expect(discarded).toEqual(['prefetched']);
      block.release();
      await tick();
    });
  });

  describe('size', () => {
    it('待機中のタスク数を返す（処理中のタスクは含まない）', async () => {
      const block = blocker();

      expect(queue.size('guild1')).toBe(0);

      queue.enqueue('guild1', async () => { await block.promise; return 'blocker'; });
      expect(queue.size('guild1')).toBe(0); // 処理中なのでキューは空

      queue.enqueue('guild1', prepare('1'));
      queue.enqueue('guild1', prepare('2'));
      expect(queue.size('guild1')).toBe(2);

      block.release();
      await tick();
      expect(queue.size('guild1')).toBe(0);
    });

    it('存在しないギルドIDに対して0を返す', () => {
      expect(queue.size('unknown')).toBe(0);
    });
  });

  describe('clear', () => {
    it('待機中のタスクをすべて破棄し破棄件数を返す', async () => {
      const block = blocker();
      queue.enqueue('guild1', async () => { await block.promise; return 'blocker'; });

      const promises: Promise<void>[] = [];
      for (let i = 0; i < 3; i++) {
        promises.push(queue.enqueue('guild1', prepare(String(i))));
      }

      const cleared = queue.clear('guild1');
      expect(cleared).toBe(3);
      expect(queue.size('guild1')).toBe(0);

      for (const p of promises) {
        await expect(p).rejects.toThrow('キューがクリアされました');
      }

      block.release();
      await tick();
    });

    it('処理中のタスクには影響しない', async () => {
      const block = blocker();
      const p = queue.enqueue('guild1', async () => {
        await block.promise;
        return '1';
      });

      queue.clear('guild1');
      block.release();
      await p;
      expect(consumed).toEqual(['1']);
    });

    it('存在しないギルドIDに対して0を返す', () => {
      expect(queue.clear('unknown')).toBe(0);
    });
  });

  it('カスタム上限を設定できる', async () => {
    const limited = new MessageQueue<string>({
      consume: async (_guildId, value) => { consumed.push(value); },
      discard: () => {}
    }, 3);

    const block = blocker();
    limited.enqueue('guild1', async () => { await block.promise; return 'blocker'; });

    const promises: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      promises.push(limited.enqueue('guild1', prepare(String(i))));
    }

    for (let i = 0; i < 2; i++) {
      await expect(promises[i]).rejects.toThrow();
    }

    block.release();
    await tick();

    expect(consumed).toEqual(['blocker', '2', '3', '4']);
  });
});
