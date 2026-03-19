import { createReloadableConfig } from './reloadableConfig';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempDir (): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reload-'));
}

function createTempFile (content: string): string {
  const dir = createTempDir();
  const filePath = path.join(dir, 'config.yml');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('createReloadableConfig', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('初期読み込み', () => {
    it('パーサーが返したデータを取得できる', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn().mockReturnValue({ key: 'value' });
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: () => '成功',
        errorLog: 'エラー'
      });
      expect(config.getData()).toEqual({ key: 'value' });
      expect(parser).toHaveBeenCalledWith(filePath);
    });

    it('パーサーがnullを返した場合はデフォルト値を返す', () => {
      const filePath = '/nonexistent/config.yml';
      const parser = jest.fn().mockReturnValue(null);
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: 'デフォルト',
        successLog: () => '成功',
        errorLog: 'エラー'
      });
      expect(config.getData()).toBe('デフォルト');
    });
  });

  describe('reload', () => {
    it('再読み込みしたデータを取得できる', () => {
      const filePath = createTempFile('key: value1');
      let callCount = 0;
      const parser = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 'first' : 'second';
      });
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: (data) => `読み込み: ${data}`,
        errorLog: 'エラー'
      });
      expect(config.getData()).toBe('first');

      config.reload();
      expect(config.getData()).toBe('second');
    });

    it('再読み込み成功時にログを出力する', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn().mockReturnValue('data');
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: () => '再読み込み成功メッセージ',
        errorLog: 'エラー'
      });
      config.reload();
      expect(console.log).toHaveBeenCalledWith('再読み込み成功メッセージ');
    });

    it('パーサーがnullを返した場合はデフォルト値を使用する', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn()
        .mockReturnValueOnce('initial')
        .mockReturnValueOnce(null);
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: 'デフォルト',
        successLog: () => '成功',
        errorLog: 'エラー'
      });
      expect(config.getData()).toBe('initial');

      config.reload();
      expect(config.getData()).toBe('デフォルト');
    });
  });

  describe('エラー耐性', () => {
    it('パーサーがエラーを投げた場合は前のデータを維持する', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn()
        .mockReturnValueOnce('initial')
        .mockImplementationOnce(() => { throw new Error('パースエラー'); });
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: () => '成功',
        errorLog: 'テスト用エラーメッセージ'
      });
      expect(config.getData()).toBe('initial');

      config.reload();
      expect(config.getData()).toBe('initial');
    });

    it('エラー時にエラーログを出力する', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn()
        .mockReturnValueOnce('initial')
        .mockImplementationOnce(() => { throw new Error('パースエラー'); });
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: () => '成功',
        errorLog: 'テスト用エラーメッセージ'
      });
      config.reload();
      expect(console.error).toHaveBeenCalledWith('テスト用エラーメッセージ', 'パースエラー');
    });

    it('Error以外の例外でもエラーログを出力する', () => {
      const filePath = createTempFile('key: value');
      const parser = jest.fn()
        .mockReturnValueOnce('initial')
        // eslint-disable-next-line no-throw-literal
        .mockImplementationOnce(() => { throw 'string error'; });
      const config = createReloadableConfig({
        filePath,
        parser,
        defaultValue: null,
        successLog: () => '成功',
        errorLog: 'テスト用エラーメッセージ'
      });
      config.reload();
      expect(console.error).toHaveBeenCalledWith('テスト用エラーメッセージ', 'string error');
    });
  });
});
