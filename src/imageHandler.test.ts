import { handleImageSummary } from './imageHandler';

describe('handleImageSummary', () => {
  const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

  let enqueueTts: jest.Mock;
  let processImageFn: jest.Mock;
  let describeImageFn: jest.Mock;
  let sendTyping: jest.Mock;
  let reply: jest.Mock;

  function createMessage (opts: {
    content?: string;
    attachments?: Array<{ size: number; contentType: string | null; url: string }>;
    guildId?: string;
  }) {
    const attachments = opts.attachments ?? [];
    const map = new Map(attachments.map((a, i) => [String(i), a]));
    sendTyping = jest.fn().mockResolvedValue(undefined);
    reply = jest.fn().mockResolvedValue(undefined);
    return {
      content: opts.content ?? '',
      guild: { id: opts.guildId ?? 'guild1' },
      attachments: {
        values: () => map.values(),
        first: () => attachments[0],
        size: map.size
      },
      channel: { sendTyping },
      reply
    } as any;
  }

  beforeEach(() => {
    enqueueTts = jest.fn();
    processImageFn = jest.fn();
    describeImageFn = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('条件判定', () => {
    it('マルチモーダル無効の場合は何もしない', async () => {
      const msg = createMessage({ attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }] });
      await handleImageSummary(msg, {
        chatMultiModal: false,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).not.toHaveBeenCalled();
    });

    it('テキストがある場合は何もしない', async () => {
      const msg = createMessage({
        content: 'テキストあり',
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).not.toHaveBeenCalled();
    });

    it('画像が2枚の場合は何もしない', async () => {
      const msg = createMessage({
        attachments: [
          { size: 100, contentType: 'image/png', url: 'http://img1' },
          { size: 100, contentType: 'image/png', url: 'http://img2' }
        ]
      });
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 2,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).not.toHaveBeenCalled();
    });

    it('動画がある場合は何もしない', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 1,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).not.toHaveBeenCalled();
    });

    it('画像サイズが50MiBを超える場合は何もしない', async () => {
      const msg = createMessage({
        attachments: [{ size: MAX_IMAGE_SIZE + 1, contentType: 'image/png', url: 'http://img' }]
      });
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).not.toHaveBeenCalled();
    });

    it('画像サイズがちょうど50MiBの場合は処理する', async () => {
      const msg = createMessage({
        attachments: [{ size: MAX_IMAGE_SIZE, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の画像');
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).toHaveBeenCalled();
    });
  });

  describe('概要取得成功時', () => {
    it('概要をTTSで読み上げ、リプライとして投稿する', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の画像');
      const voice = { model: 'alloy', voice: 'alloy' };
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: voice,
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).toHaveBeenCalledWith('http://img');
      expect(describeImageFn).toHaveBeenCalledWith('data:image/jpeg;base64,abc');
      expect(enqueueTts).toHaveBeenCalledWith('guild1', '概要：猫の画像', voice);
      expect(reply).toHaveBeenCalledWith('概要：猫の画像');
    });

    it('typingインジケーターを送信する', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の画像');
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(sendTyping).toHaveBeenCalled();
    });
  });

  describe('概要が空の場合', () => {
    it('TTSもリプライも行わない', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('');
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(reply).not.toHaveBeenCalled();
    });
  });

  describe('エラー時', () => {
    it('processImageでエラーが発生した場合はTTSもリプライも行わない', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockRejectedValue(new Error('ダウンロード失敗'));
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(reply).not.toHaveBeenCalled();
    });

    it('describeImageでエラーが発生した場合はTTSもリプライも行わない', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockRejectedValue(new Error('API失敗'));
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(reply).not.toHaveBeenCalled();
    });

    it('リプライ送信エラーはログのみで握りつぶす', async () => {
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の画像');
      reply.mockRejectedValue(new Error('送信失敗'));
      await handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(enqueueTts).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('リプライ送信エラー'));
    });
  });

  describe('typingインターバル', () => {
    it('完了後にインターバルがクリアされる', async () => {
      jest.useFakeTimers();
      const msg = createMessage({
        attachments: [{ size: 100, contentType: 'image/png', url: 'http://img' }]
      });
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の画像');
      const promise = handleImageSummary(msg, {
        chatMultiModal: true,
        imageCount: 1,
        videoCount: 0,
        userVoice: {},
        enqueueTts,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      await promise;
      // インターバルがクリアされていれば、タイマーを進めてもsendTypingは追加呼び出しされない
      const callCount = sendTyping.mock.calls.length;
      jest.advanceTimersByTime(16_000);
      expect(sendTyping.mock.calls.length).toBe(callCount);
      jest.useRealTimers();
    });
  });
});
