import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigWatcher } from './configWatcher';

function createTempDir (): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cfgwatch-'));
}

function wait (ms: number = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ConfigWatcher', () => {
  let watcher: ConfigWatcher;
  let dir: string;

  beforeEach(() => {
    dir = createTempDir();
  });

  afterEach(() => {
    if (watcher) {
      watcher.close();
    }
  });

  describe('ファイル変更の検知', () => {
    it('登録済みファイルが変更されたらコールバックを呼ぶ', async () => {
      const filePath = path.join(dir, 'test.yml');
      fs.writeFileSync(filePath, 'initial', 'utf-8');

      const callback = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('test.yml', callback);

      fs.writeFileSync(filePath, 'updated', 'utf-8');
      await wait();

      expect(callback).toHaveBeenCalled();
    });

    it('登録済みファイルが新規作成されたらコールバックを呼ぶ', async () => {
      const callback = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('new.yml', callback);

      fs.writeFileSync(path.join(dir, 'new.yml'), 'content', 'utf-8');
      await wait();

      expect(callback).toHaveBeenCalled();
    });

    it('登録済みファイルが削除されたらコールバックを呼ぶ', async () => {
      const filePath = path.join(dir, 'del.yml');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      const callback = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('del.yml', callback);

      fs.unlinkSync(filePath);
      await wait();

      expect(callback).toHaveBeenCalled();
    });

    it('未登録のファイルが変更されてもコールバックは呼ばれない', async () => {
      const callback = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('watched.yml', callback);

      fs.writeFileSync(path.join(dir, 'other.yml'), 'content', 'utf-8');
      await wait();

      expect(callback).not.toHaveBeenCalled();
    });

    it('複数のファイルをそれぞれ独立に監視できる', async () => {
      fs.writeFileSync(path.join(dir, 'a.yml'), 'a', 'utf-8');
      fs.writeFileSync(path.join(dir, 'b.yml'), 'b', 'utf-8');

      const callbackA = jest.fn();
      const callbackB = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('a.yml', callbackA);
      watcher.on('b.yml', callbackB);

      fs.writeFileSync(path.join(dir, 'a.yml'), 'updated-a', 'utf-8');
      await wait();

      expect(callbackA).toHaveBeenCalled();
      expect(callbackB).not.toHaveBeenCalled();
    });
  });

  describe('デバウンス', () => {
    it('短時間に複数回変更されてもコールバックは1回だけ呼ばれる', async () => {
      const filePath = path.join(dir, 'debounce.yml');
      fs.writeFileSync(filePath, 'v0', 'utf-8');

      const callback = jest.fn();
      watcher = new ConfigWatcher(dir, 200);
      watcher.on('debounce.yml', callback);

      fs.writeFileSync(filePath, 'v1', 'utf-8');
      await new Promise((resolve) => setTimeout(resolve, 50));
      fs.writeFileSync(filePath, 'v2', 'utf-8');
      await new Promise((resolve) => setTimeout(resolve, 50));
      fs.writeFileSync(filePath, 'v3', 'utf-8');
      await wait(400);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('close', () => {
    it('close後はファイル変更を検知しない', async () => {
      const filePath = path.join(dir, 'closed.yml');
      fs.writeFileSync(filePath, 'initial', 'utf-8');

      const callback = jest.fn();
      watcher = new ConfigWatcher(dir);
      watcher.on('closed.yml', callback);
      watcher.close();

      fs.writeFileSync(filePath, 'updated', 'utf-8');
      await wait();

      expect(callback).not.toHaveBeenCalled();
    });

    it('二重closeでもエラーにならない', () => {
      watcher = new ConfigWatcher(dir);
      watcher.close();
      watcher.close();
    });
  });
});
