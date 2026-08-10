import { withRetry, withRetryResult } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1回目で成功した場合はそのまま完了する', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await withRetry('テスト', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失敗後にリトライして成功する', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('失敗1'))
      .mockResolvedValue(undefined);
    await withRetry('テスト', fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('3回すべて失敗した場合は警告ログを出力する', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('常に失敗'));
    await withRetry('操作名', fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('操作名 (3/3): 常に失敗')
    );
  });

  it('Error以外のオブジェクトがスローされた場合も処理できる', async () => {
    const fn = jest.fn().mockRejectedValue('文字列エラー');
    await withRetry('テスト', fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('文字列エラー')
    );
  });
});

describe('withRetryResult', () => {
  it('1回目で成功した場合はその結果を返す', async () => {
    const fn = jest.fn().mockResolvedValue('結果');
    await expect(withRetryResult(fn)).resolves.toBe('結果');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失敗後にリトライして成功した場合はその結果を返す', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('失敗1'))
      .mockRejectedValueOnce(new Error('失敗2'))
      .mockResolvedValue('結果');
    await expect(withRetryResult(fn)).resolves.toBe('結果');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('3回すべて失敗した場合は最後のエラーを投げる', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('失敗1'))
      .mockRejectedValueOnce(new Error('失敗2'))
      .mockRejectedValue(new Error('失敗3'));
    await expect(withRetryResult(fn)).rejects.toThrow('失敗3');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('Error以外のオブジェクトがスローされた場合もそのまま投げる', async () => {
    const fn = jest.fn().mockRejectedValue('文字列エラー');
    await expect(withRetryResult(fn)).rejects.toBe('文字列エラー');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('undefined を返す関数でも結果を返せる', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('失敗1'))
      .mockResolvedValue(undefined);
    await expect(withRetryResult(fn)).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
