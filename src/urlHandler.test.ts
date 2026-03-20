import { handleUrlSummary } from './urlHandler';
import { DownloadResult } from './downloader';

const mockDownloadBuffer = jest.fn();
jest.mock('./downloader', () => ({
  downloadBuffer: (...args: unknown[]) => mockDownloadBuffer(...args)
}));

describe('handleUrlSummary', () => {
  let enqueueTts: jest.Mock;
  let summarizeUrl: jest.Mock;
  let processImageFn: jest.Mock;
  let describeImageFn: jest.Mock;
  let sendTyping: jest.Mock;
  let reply: jest.Mock;
  let editPlaceholder: jest.Mock;
  let deletePlaceholder: jest.Mock;

  function createDownloadResult (body: string, contentType: string): DownloadResult {
    const buf = Buffer.from(body) as DownloadResult;
    buf.contentType = contentType;
    return buf;
  }

  function createMessage (content: string, guildId: string = 'guild1') {
    sendTyping = jest.fn().mockResolvedValue(undefined);
    editPlaceholder = jest.fn().mockResolvedValue(undefined);
    deletePlaceholder = jest.fn().mockResolvedValue(undefined);
    reply = jest.fn().mockResolvedValue({ edit: editPlaceholder, delete: deletePlaceholder });
    return {
      content,
      guild: { id: guildId },
      channel: { sendTyping },
      reply
    } as any;
  }

  function callHandler (msg: any, opts?: { chatMultiModal?: boolean }) {
    return handleUrlSummary(msg, {
      chatMultiModal: opts?.chatMultiModal ?? false,
      userVoice: {},
      enqueueTts,
      summarizeUrl,
      processImage: processImageFn,
      describeImage: describeImageFn
    });
  }

  beforeEach(() => {
    enqueueTts = jest.fn();
    summarizeUrl = jest.fn();
    processImageFn = jest.fn();
    describeImageFn = jest.fn();
    mockDownloadBuffer.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('条件判定', () => {
    it('URLのみのメッセージで処理を開始する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('<html><body>Hello</body></html>', 'text/html'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://example.com');
    });

    it('URL以外のテキストがある場合は何もしない', async () => {
      const msg = createMessage('こちら https://example.com を見て');
      await callHandler(msg);
      expect(mockDownloadBuffer).not.toHaveBeenCalled();
    });

    it('URLが2つある場合は何もしない', async () => {
      const msg = createMessage('https://example.com https://example.org');
      await callHandler(msg);
      expect(mockDownloadBuffer).not.toHaveBeenCalled();
    });

    it('空メッセージでは何もしない', async () => {
      const msg = createMessage('');
      await callHandler(msg);
      expect(mockDownloadBuffer).not.toHaveBeenCalled();
    });

    it('URLの前後に空白があっても処理する', async () => {
      const msg = createMessage('  https://example.com  ');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://example.com');
    });

    it('http:// のURLも処理する', async () => {
      const msg = createMessage('http://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('http://example.com');
    });
  });

  describe('プレースホルダー投稿', () => {
    it('ダウンロードと並行してプレースホルダーをリプライ投稿する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('<html><body>Hello</body></html>', 'text/html'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      expect(reply).toHaveBeenCalledWith('要約：解析中...');
    });
  });

  describe('HTMLの処理', () => {
    it('HTMLタグを除去してテキストを抽出する', async () => {
      const html = '<html><head><title>Test</title></head><body><h1>見出し</h1><p>本文です</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html; charset=utf-8'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      // summarizeUrl に渡されるテキストにHTMLタグが含まれない
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).not.toMatch(/<[^>]+>/);
      expect(passedText).toContain('見出し');
      expect(passedText).toContain('本文です');
    });

    it('scriptタグとstyleタグの内容を除去する', async () => {
      const html = '<html><head><style>body{color:red}</style></head><body><script>alert("xss")</script><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).not.toContain('alert');
      expect(passedText).not.toContain('color:red');
      expect(passedText).toContain('本文');
    });

    it('連続する空白と改行を正規化する', async () => {
      const html = '<html><body><p>段落1</p>\n\n\n<p>段落2</p>   <p>段落3</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テストページ');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).not.toMatch(/\n{2,}/);
      expect(passedText).not.toMatch(/\s{3,}/);
    });
  });

  describe('プレインテキストの処理', () => {
    it('text/plain のレスポンスをそのまま要約に渡す', async () => {
      const msg = createMessage('https://example.com/data.txt');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('これはテスト文書です', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト文書の要約');
      await callHandler(msg);
      expect(summarizeUrl).toHaveBeenCalledWith('これはテスト文書です');
    });
  });

  describe('要約成功時', () => {
    it('要約をTTSで読み上げ、プレースホルダーを編集する', async () => {
      const msg = createMessage('https://example.com');
      const voice = { model: 'alloy', voice: 'alloy' };
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello World', 'text/plain'));
      summarizeUrl.mockResolvedValue('英語の挨拶ページ');
      await handleUrlSummary(msg, {
        chatMultiModal: false,
        userVoice: voice,
        enqueueTts,
        summarizeUrl,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(enqueueTts).toHaveBeenCalledWith('guild1', '要約：英語の挨拶ページ', voice);
      expect(editPlaceholder).toHaveBeenCalledWith('要約：英語の挨拶ページ');
    });

    it('typingインジケーターを送信する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      expect(sendTyping).toHaveBeenCalled();
    });
  });

  describe('テキスト以外のcontent-type', () => {
    it('application/pdf の場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/doc.pdf');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'application/pdf'));
      await callHandler(msg);
      expect(summarizeUrl).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('content-type が空の場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/unknown');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('data', ''));
      await callHandler(msg);
      expect(summarizeUrl).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('対応していない画像形式の場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/image.svg');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/svg+xml'));
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('マルチモーダル無効時は対応画像でもプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/image.png');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/png'));
      await callHandler(msg, { chatMultiModal: false });
      expect(processImageFn).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });
  });

  describe('画像解析', () => {
    it('image/jpeg の場合に画像を解析して概要を表示する', async () => {
      const msg = createMessage('https://example.com/photo.jpg');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/jpeg'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫が寝ている写真');
      const voice = { model: 'alloy', voice: 'alloy' };
      await handleUrlSummary(msg, {
        chatMultiModal: true,
        userVoice: voice,
        enqueueTts,
        summarizeUrl,
        processImage: processImageFn,
        describeImage: describeImageFn
      });
      expect(processImageFn).toHaveBeenCalledWith('https://example.com/photo.jpg');
      expect(describeImageFn).toHaveBeenCalledWith('data:image/jpeg;base64,abc');
      expect(enqueueTts).toHaveBeenCalledWith('guild1', '概要：猫が寝ている写真', voice);
      expect(editPlaceholder).toHaveBeenCalledWith('概要：猫が寝ている写真');
    });

    it('image/png の場合も画像を解析する', async () => {
      const msg = createMessage('https://example.com/image.png');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/png'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('スクリーンショット');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('image/gif の場合も画像を解析する', async () => {
      const msg = createMessage('https://example.com/anim.gif');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/gif'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('アニメーション');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('image/webp の場合も画像を解析する', async () => {
      const msg = createMessage('https://example.com/image.webp');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/webp'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('画像');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('image/bmp の場合も画像を解析する', async () => {
      const msg = createMessage('https://example.com/image.bmp');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/bmp'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('画像');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('image/tiff の場合も画像を解析する', async () => {
      const msg = createMessage('https://example.com/image.tiff');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/tiff'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('画像');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('画像の概要が空の場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/photo.jpg');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/jpeg'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('');
      await callHandler(msg, { chatMultiModal: true });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('processImage でエラーが発生した場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/photo.jpg');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/jpeg'));
      processImageFn.mockRejectedValue(new Error('変換失敗'));
      await callHandler(msg, { chatMultiModal: true });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('describeImage でエラーが発生した場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/photo.jpg');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/jpeg'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockRejectedValue(new Error('API失敗'));
      await callHandler(msg, { chatMultiModal: true });
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('画像サイズが50MiBを超える場合はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com/huge.jpg');
      const largeResult = Buffer.alloc(50 * 1024 * 1024 + 1) as DownloadResult;
      largeResult.contentType = 'image/jpeg';
      mockDownloadBuffer.mockResolvedValue(largeResult);
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });

    it('画像サイズがちょうど50MiBの場合は処理する', async () => {
      const msg = createMessage('https://example.com/large.jpg');
      const result = Buffer.alloc(50 * 1024 * 1024) as DownloadResult;
      result.contentType = 'image/jpeg';
      mockDownloadBuffer.mockResolvedValue(result);
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('大きな画像');
      await callHandler(msg, { chatMultiModal: true });
      expect(processImageFn).toHaveBeenCalled();
    });

    it('プレースホルダー投稿失敗時は概要取得後に新規リプライで投稿する', async () => {
      const msg = createMessage('https://example.com/photo.jpg');
      reply.mockRejectedValueOnce(new Error('送信失敗'))
        .mockResolvedValueOnce(undefined);
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/jpeg'));
      processImageFn.mockResolvedValue('data:image/jpeg;base64,abc');
      describeImageFn.mockResolvedValue('猫の写真');
      await callHandler(msg, { chatMultiModal: true });
      expect(reply).toHaveBeenCalledWith('概要：猫の写真');
    });
  });

  describe('ダウンロードエラー時', () => {
    it('ダウンロード失敗時はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockRejectedValue(new Error('ダウンロードに失敗: HTTP 500'));
      await callHandler(msg);
      expect(summarizeUrl).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('要約エラー時', () => {
    it('要約失敗時はプレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockRejectedValue(new Error('API失敗'));
      await callHandler(msg);
      expect(deletePlaceholder).toHaveBeenCalled();
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('要約が空の場合', () => {
    it('TTSを行わず、プレースホルダーを削除する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('');
      await callHandler(msg);
      expect(enqueueTts).not.toHaveBeenCalled();
      expect(deletePlaceholder).toHaveBeenCalled();
    });
  });

  describe('プレースホルダーのリトライ', () => {
    it('プレースホルダー編集が2回失敗しても3回目で成功する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      editPlaceholder
        .mockRejectedValueOnce(new Error('編集失敗1'))
        .mockRejectedValueOnce(new Error('編集失敗2'))
        .mockResolvedValueOnce(undefined);
      await callHandler(msg);
      expect(editPlaceholder).toHaveBeenCalledTimes(3);
      expect(enqueueTts).toHaveBeenCalled();
    });

    it('プレースホルダー削除が2回失敗しても3回目で成功する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'image/png'));
      deletePlaceholder
        .mockRejectedValueOnce(new Error('削除失敗1'))
        .mockRejectedValueOnce(new Error('削除失敗2'))
        .mockResolvedValueOnce(undefined);
      await callHandler(msg);
      expect(deletePlaceholder).toHaveBeenCalledTimes(3);
    });

    it('プレースホルダー投稿失敗時、成功すれば新規リプライにフォールバックする', async () => {
      const msg = createMessage('https://example.com');
      reply.mockRejectedValueOnce(new Error('送信失敗'))
        .mockResolvedValueOnce(undefined);
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト要約');
      await callHandler(msg);
      expect(enqueueTts).toHaveBeenCalled();
      expect(reply).toHaveBeenCalledWith('要約：テスト要約');
    });

    it('プレースホルダー投稿失敗かつダウンロードエラー時はTTSもリプライも行わない', async () => {
      const msg = createMessage('https://example.com');
      reply.mockRejectedValue(new Error('送信失敗'));
      mockDownloadBuffer.mockRejectedValue(new Error('ダウンロード失敗'));
      await callHandler(msg);
      expect(enqueueTts).not.toHaveBeenCalled();
    });

    it('プレースホルダー投稿失敗かつテキスト以外の場合はTTSもリプライも行わない', async () => {
      const msg = createMessage('https://example.com');
      reply.mockRejectedValue(new Error('送信失敗'));
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('binary', 'application/octet-stream'));
      await callHandler(msg);
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('typingインターバル', () => {
    it('完了後にインターバルがクリアされる', async () => {
      jest.useFakeTimers();
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      const promise = callHandler(msg);
      await promise;
      const callCount = sendTyping.mock.calls.length;
      jest.advanceTimersByTime(16_000);
      expect(sendTyping.mock.calls.length).toBe(callCount);
      jest.useRealTimers();
    });
  });

  describe('TTS読み上げテキストの制限', () => {
    it('150文字を超える要約は切り取って「以下略」を付加する', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      const longSummary = 'あ'.repeat(200);
      summarizeUrl.mockResolvedValue(longSummary);
      await callHandler(msg);
      const ttsText = enqueueTts.mock.calls[0][1] as string;
      // 「要約：」(3文字) + 内容 = 150文字で切り取り + 「以下略」
      expect(ttsText.length).toBeLessThanOrEqual(150 + 3);
      expect(ttsText).toContain('以下略');
    });

    it('リプライ本文は500文字で切り取る', async () => {
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      const longSummary = 'あ'.repeat(600);
      summarizeUrl.mockResolvedValue(longSummary);
      await callHandler(msg);
      const replyText = editPlaceholder.mock.calls[0][0] as string;
      expect(replyText.length).toBeLessThanOrEqual(500);
    });
  });
});
