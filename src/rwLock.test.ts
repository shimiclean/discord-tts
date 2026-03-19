import { RWLock } from './rwLock';

function delay (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RWLock', () => {
  it('読み取りロック内でコールバックの戻り値を返す', async () => {
    const lock = new RWLock();
    const result = await lock.withReadLock(() => 42);
    expect(result).toBe(42);
  });

  it('書き込みロック内でコールバックの戻り値を返す', async () => {
    const lock = new RWLock();
    const result = await lock.withWriteLock(() => 'ok');
    expect(result).toBe('ok');
  });

  it('読み取りロックは複数同時に取得できる', async () => {
    const lock = new RWLock();
    const log: string[] = [];

    await Promise.all([
      lock.withReadLock(async () => {
        log.push('r1-start');
        await delay(50);
        log.push('r1-end');
      }),
      lock.withReadLock(async () => {
        log.push('r2-start');
        await delay(50);
        log.push('r2-end');
      })
    ]);

    // 両方の読み取りが同時に開始できる
    expect(log.indexOf('r1-start')).toBeLessThan(log.indexOf('r1-end'));
    expect(log.indexOf('r2-start')).toBeLessThan(log.indexOf('r2-end'));
    expect(log.indexOf('r2-start')).toBeLessThan(log.indexOf('r1-end'));
  });

  it('書き込みロック中は読み取りロックが待機する', async () => {
    const lock = new RWLock();
    const log: string[] = [];

    const writePromise = lock.withWriteLock(async () => {
      log.push('w-start');
      await delay(50);
      log.push('w-end');
    });

    // 書き込みロックが取得された後に読み取りを試みる
    await delay(5);
    const readPromise = lock.withReadLock(() => {
      log.push('r-start');
    });

    await Promise.all([writePromise, readPromise]);

    expect(log.indexOf('w-end')).toBeLessThan(log.indexOf('r-start'));
  });

  it('読み取りロック中は書き込みロックが待機する', async () => {
    const lock = new RWLock();
    const log: string[] = [];

    const readPromise = lock.withReadLock(async () => {
      log.push('r-start');
      await delay(50);
      log.push('r-end');
    });

    await delay(5);
    const writePromise = lock.withWriteLock(() => {
      log.push('w-start');
    });

    await Promise.all([readPromise, writePromise]);

    expect(log.indexOf('r-end')).toBeLessThan(log.indexOf('w-start'));
  });

  it('書き込みロックは同時に1つだけ取得できる', async () => {
    const lock = new RWLock();
    const log: string[] = [];

    const w1 = lock.withWriteLock(async () => {
      log.push('w1-start');
      await delay(50);
      log.push('w1-end');
    });

    await delay(5);
    const w2 = lock.withWriteLock(async () => {
      log.push('w2-start');
      await delay(50);
      log.push('w2-end');
    });

    await Promise.all([w1, w2]);

    expect(log.indexOf('w1-end')).toBeLessThan(log.indexOf('w2-start'));
  });

  it('コールバックが例外を投げた場合もロックを解放する', async () => {
    const lock = new RWLock();

    await expect(lock.withWriteLock(() => {
      throw new Error('テストエラー');
    })).rejects.toThrow('テストエラー');

    // ロック解放後に再取得できる
    const result = await lock.withReadLock(() => 'ok');
    expect(result).toBe('ok');
  });

  it('非同期コールバックが例外を投げた場合もロックを解放する', async () => {
    const lock = new RWLock();

    await expect(lock.withReadLock(async () => {
      throw new Error('非同期エラー');
    })).rejects.toThrow('非同期エラー');

    const result = await lock.withWriteLock(() => 'ok');
    expect(result).toBe('ok');
  });

  describe('withReadLockSync', () => {
    it('コールバックの戻り値を返す', () => {
      const lock = new RWLock();
      expect(lock.withReadLockSync(() => 42)).toBe(42);
    });

    it('例外時にロックを解放する', () => {
      const lock = new RWLock();
      expect(() => {
        lock.withReadLockSync(() => { throw new Error('エラー'); });
      }).toThrow('エラー');
      expect(lock.withReadLockSync(() => 'ok')).toBe('ok');
    });
  });

  describe('withWriteLockSync', () => {
    it('コールバックの戻り値を返す', () => {
      const lock = new RWLock();
      expect(lock.withWriteLockSync(() => 'exclusive')).toBe('exclusive');
    });

    it('例外時にロックを解放する', () => {
      const lock = new RWLock();
      expect(() => {
        lock.withWriteLockSync(() => { throw new Error('エラー'); });
      }).toThrow('エラー');
      expect(lock.withWriteLockSync(() => 'ok')).toBe('ok');
    });
  });
});
