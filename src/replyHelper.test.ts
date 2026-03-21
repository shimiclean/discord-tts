import {
  withRetry,
  createTypingIndicator,
  sendPlaceholder,
  editPlaceholder,
  deletePlaceholder
} from './replyHelper';

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

describe('createTypingIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('開始時にsendTypingを呼び出す', () => {
    const sendTyping = jest.fn().mockResolvedValue(undefined);
    const channel = { sendTyping };
    createTypingIndicator(channel);
    expect(sendTyping).toHaveBeenCalledTimes(1);
  });

  it('8秒ごとにsendTypingを繰り返す', () => {
    const sendTyping = jest.fn().mockResolvedValue(undefined);
    const channel = { sendTyping };
    createTypingIndicator(channel);
    jest.advanceTimersByTime(16_000);
    expect(sendTyping).toHaveBeenCalledTimes(3); // 初回 + 8秒後 + 16秒後
  });

  it('stop関数でインターバルを停止する', () => {
    const sendTyping = jest.fn().mockResolvedValue(undefined);
    const channel = { sendTyping };
    const stop = createTypingIndicator(channel);
    stop();
    jest.advanceTimersByTime(16_000);
    expect(sendTyping).toHaveBeenCalledTimes(1); // 初回のみ
  });

  it('sendTypingがないチャンネルでもエラーにならない', () => {
    const channel = {};
    expect(() => createTypingIndicator(channel)).not.toThrow();
  });

  it('sendTypingの失敗を無視する', () => {
    const sendTyping = jest.fn().mockRejectedValue(new Error('失敗'));
    const channel = { sendTyping };
    expect(() => createTypingIndicator(channel)).not.toThrow();
  });
});

describe('sendPlaceholder', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('リプライが成功した場合はメッセージを返す', async () => {
    const placeholderMsg = { id: 'placeholder1' };
    const message = { reply: jest.fn().mockResolvedValue(placeholderMsg) } as any;
    const result = await sendPlaceholder(message, 'テスト中...');
    expect(message.reply).toHaveBeenCalledWith('テスト中...');
    expect(result).toBe(placeholderMsg);
  });

  it('リプライが失敗した場合はnullを返す', async () => {
    const message = { reply: jest.fn().mockRejectedValue(new Error('失敗')) } as any;
    const result = await sendPlaceholder(message, 'テスト中...');
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('editPlaceholder', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('プレースホルダーが存在する場合はeditを呼び出す', async () => {
    const placeholder = { edit: jest.fn().mockResolvedValue(undefined) } as any;
    const message = { reply: jest.fn() } as any;
    await editPlaceholder(placeholder, message, '更新テキスト');
    expect(placeholder.edit).toHaveBeenCalledWith('更新テキスト');
    expect(message.reply).not.toHaveBeenCalled();
  });

  it('プレースホルダーがnullの場合はフォールバックリプライを送信する', async () => {
    const message = { reply: jest.fn().mockResolvedValue(undefined) } as any;
    await editPlaceholder(null, message, '更新テキスト');
    expect(message.reply).toHaveBeenCalledWith('更新テキスト');
  });

  it('edit失敗時にリトライする', async () => {
    const placeholder = {
      edit: jest.fn()
        .mockRejectedValueOnce(new Error('1回目失敗'))
        .mockResolvedValue(undefined)
    } as any;
    const message = { reply: jest.fn() } as any;
    await editPlaceholder(placeholder, message, 'テキスト');
    expect(placeholder.edit).toHaveBeenCalledTimes(2);
  });

  it('フォールバックリプライ失敗時にリトライする', async () => {
    const message = {
      reply: jest.fn()
        .mockRejectedValueOnce(new Error('1回目失敗'))
        .mockResolvedValue(undefined)
    } as any;
    await editPlaceholder(null, message, 'テキスト');
    expect(message.reply).toHaveBeenCalledTimes(2);
  });
});

describe('deletePlaceholder', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('プレースホルダーが存在する場合はdeleteを呼び出す', async () => {
    const placeholder = { delete: jest.fn().mockResolvedValue(undefined) } as any;
    await deletePlaceholder(placeholder);
    expect(placeholder.delete).toHaveBeenCalled();
  });

  it('プレースホルダーがnullの場合は何もしない', async () => {
    await expect(deletePlaceholder(null)).resolves.toBeUndefined();
  });

  it('delete失敗時にリトライする', async () => {
    const placeholder = {
      delete: jest.fn()
        .mockRejectedValueOnce(new Error('1回目失敗'))
        .mockResolvedValue(undefined)
    } as any;
    await deletePlaceholder(placeholder);
    expect(placeholder.delete).toHaveBeenCalledTimes(2);
  });
});
