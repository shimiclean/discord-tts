import {
  createTypingIndicator,
  sendPlaceholder,
  editPlaceholder,
  deletePlaceholder
} from './replyHelper';
import { summaryReplyTracker } from './summaryReplyTracker';

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
    const message = { id: 'origin1', reply: jest.fn().mockResolvedValue(placeholderMsg) } as any;
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

  it('送信したプレースホルダーをギルド・元メッセージに紐付けて追跡する', async () => {
    const placeholderMsg = { id: 'placeholder2', delete: jest.fn().mockResolvedValue(undefined) };
    const message = {
      id: 'origin2',
      guildId: 'guild1',
      reply: jest.fn().mockResolvedValue(placeholderMsg)
    } as any;
    await sendPlaceholder(message, 'テスト中...');
    await summaryReplyTracker.handleDelete('guild1', 'origin2');
    expect(placeholderMsg.delete).toHaveBeenCalledTimes(1);
  });

  it('ギルド外のメッセージへのプレースホルダーは追跡しない', async () => {
    const track = jest.spyOn(summaryReplyTracker, 'track');
    const placeholderMsg = { id: 'placeholder4', delete: jest.fn().mockResolvedValue(undefined) };
    const message = {
      id: 'origin5',
      guildId: null,
      reply: jest.fn().mockResolvedValue(placeholderMsg)
    } as any;
    await sendPlaceholder(message, 'テスト中...');
    expect(track).not.toHaveBeenCalled();
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

  it('フォールバックリプライも元メッセージに紐付けて追跡する', async () => {
    const fallbackMsg = { id: 'fallback1', delete: jest.fn().mockResolvedValue(undefined) };
    const message = {
      id: 'origin3',
      guildId: 'guild1',
      reply: jest.fn().mockResolvedValue(fallbackMsg)
    } as any;
    await editPlaceholder(null, message, 'テキスト');
    await summaryReplyTracker.handleDelete('guild1', 'origin3');
    expect(fallbackMsg.delete).toHaveBeenCalledTimes(1);
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

  it('削除したプレースホルダーは追跡対象から外す', async () => {
    const placeholderMsg = { id: 'placeholder3', delete: jest.fn().mockResolvedValue(undefined) };
    const message = {
      id: 'origin4',
      guildId: 'guild1',
      reply: jest.fn().mockResolvedValue(placeholderMsg)
    } as any;
    await sendPlaceholder(message, 'テスト中...');
    await deletePlaceholder(placeholderMsg as any);
    await summaryReplyTracker.handleDelete('guild1', 'origin4');
    expect(placeholderMsg.delete).toHaveBeenCalledTimes(1);
  });
});
