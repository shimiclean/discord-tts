import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';
import { buffer as readAll } from 'stream/consumers';
import { AudioCache } from './audioCache';

function tmpDir (): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'audio-cache-')), 'cache');
}

function producer (data: string): jest.Mock<Promise<Readable>, []> {
  return jest.fn(() => Promise.resolve(Readable.from([Buffer.from(data)])));
}

const KEY = { text: '太郎が参加しました', model: 'tts-1', voice: 'nova', speed: 1.5 };

describe('AudioCache', () => {
  it('キャッシュが無い場合は合成結果を返す', async () => {
    const cache = new AudioCache(tmpDir());
    const produce = producer('音声データ');

    const result = await readAll(await cache.load(KEY, produce));

    expect(result).toEqual(Buffer.from('音声データ'));
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('2回目は合成せずキャッシュから返す', async () => {
    const cache = new AudioCache(tmpDir());
    const produce = producer('音声データ');

    await readAll(await cache.load(KEY, produce));
    const result = await readAll(await cache.load(KEY, produce));

    expect(result).toEqual(Buffer.from('音声データ'));
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('別インスタンスでも同じディレクトリならキャッシュが使われる', async () => {
    const dir = tmpDir();
    const produce = producer('音声データ');

    await readAll(await new AudioCache(dir).load(KEY, produce));
    const result = await readAll(await new AudioCache(dir).load(KEY, produce));

    expect(result).toEqual(Buffer.from('音声データ'));
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('ディレクトリが存在しない場合は作成する', async () => {
    const dir = tmpDir();
    expect(fs.existsSync(dir)).toBe(false);

    await readAll(await new AudioCache(dir).load(KEY, producer('音声データ')));

    expect(fs.existsSync(dir)).toBe(true);
  });

  it('ファイル名は sha256 のハッシュ値に .opus 拡張子を付けたもの', async () => {
    const dir = tmpDir();

    await readAll(await new AudioCache(dir).load(KEY, producer('音声データ')));

    const files = fs.readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f]{64}\.opus$/);
  });

  it('一時ファイルを残さない', async () => {
    const dir = tmpDir();
    const cache = new AudioCache(dir);

    await readAll(await cache.load(KEY, producer('音声1')));
    await readAll(await cache.load({ ...KEY, text: '別の文' }, producer('音声2')));

    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0);
  });

  describe('キャッシュキー', () => {
    it('テキストが異なれば別のキャッシュになる', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = producer('音声データ');

      await readAll(await cache.load(KEY, produce));
      await readAll(await cache.load({ ...KEY, text: '次郎が参加しました' }, produce));

      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('モデルが異なれば別のキャッシュになる', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = producer('音声データ');

      await readAll(await cache.load(KEY, produce));
      await readAll(await cache.load({ ...KEY, model: 'zundamon' }, produce));

      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('ボイスが異なれば別のキャッシュになる', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = producer('音声データ');

      await readAll(await cache.load(KEY, produce));
      await readAll(await cache.load({ ...KEY, voice: 'alloy' }, produce));

      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('速度が異なれば別のキャッシュになる', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = producer('音声データ');

      await readAll(await cache.load(KEY, produce));
      await readAll(await cache.load({ ...KEY, speed: 1.75 }, produce));

      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('キーの区切りをまたいだ値が同一キーに衝突しない', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = producer('音声データ');

      await readAll(await cache.load({ ...KEY, text: 'あ', model: 'いう' }, produce));
      await readAll(await cache.load({ ...KEY, text: 'あい', model: 'う' }, produce));

      expect(produce).toHaveBeenCalledTimes(2);
    });
  });

  describe('異常系', () => {
    it('合成結果が空の場合は保存せず、次回も合成する', async () => {
      const dir = tmpDir();
      const cache = new AudioCache(dir);
      const produce = jest.fn(() => Promise.resolve(Readable.from([])));

      const result = await readAll(await cache.load(KEY, produce));

      expect(result).toHaveLength(0);
      expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toHaveLength(0);

      await readAll(await cache.load(KEY, produce));
      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('空のキャッシュファイルが残っていた場合は合成にフォールバックする', async () => {
      const dir = tmpDir();
      const cache = new AudioCache(dir);
      const produce = producer('音声データ');

      await readAll(await cache.load(KEY, produce));
      const file = path.join(dir, fs.readdirSync(dir)[0]);
      fs.writeFileSync(file, '');

      const result = await readAll(await cache.load(KEY, produce));

      expect(result).toEqual(Buffer.from('音声データ'));
      expect(produce).toHaveBeenCalledTimes(2);
    });

    it('書き込みに失敗しても合成結果は返す', async () => {
      // ディレクトリ名と同名のファイルを作り、mkdir を失敗させる
      const dir = tmpDir();
      fs.writeFileSync(dir, '');
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await readAll(await new AudioCache(dir).load(KEY, producer('音声データ')));

      expect(result).toEqual(Buffer.from('音声データ'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('音声キャッシュ'));
      jest.restoreAllMocks();
    });

    it('合成が失敗した場合はエラーを伝播する', async () => {
      const cache = new AudioCache(tmpDir());
      const produce = jest.fn(() => Promise.reject(new Error('合成失敗')));

      await expect(cache.load(KEY, produce)).rejects.toThrow('合成失敗');
    });

    it('合成ストリームがエラーになった場合はエラーを伝播する', async () => {
      const dir = tmpDir();
      const cache = new AudioCache(dir);
      const produce = jest.fn(() => Promise.resolve(
        new Readable({
          read () {
            this.destroy(new Error('ffmpeg 失敗'));
          }
        })
      ));

      await expect(cache.load(KEY, produce)).rejects.toThrow('ffmpeg 失敗');
      expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toHaveLength(0);
    });
  });
});
