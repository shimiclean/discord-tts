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

  function createDownloadResult (body: string | Buffer, contentType: string): DownloadResult {
    const buf = (typeof body === 'string' ? Buffer.from(body) : body) as DownloadResult;
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

  describe('X/Twitter URL変換', () => {
    it('x.com のURLを fxtwitter.com に変換してリクエストする', async () => {
      const msg = createMessage('https://x.com/kis/status/2034996328019931441');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('ツイート内容', 'text/html'));
      summarizeUrl.mockResolvedValue('ツイートの要約');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://fxtwitter.com/kis/status/2034996328019931441');
    });

    it('twitter.com のURLを fxtwitter.com に変換してリクエストする', async () => {
      const msg = createMessage('https://twitter.com/user/status/123456');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('ツイート内容', 'text/html'));
      summarizeUrl.mockResolvedValue('ツイートの要約');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://fxtwitter.com/user/status/123456');
    });

    it('www.x.com も変換する', async () => {
      const msg = createMessage('https://www.x.com/user/status/789');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('ツイート内容', 'text/html'));
      summarizeUrl.mockResolvedValue('ツイートの要約');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://fxtwitter.com/user/status/789');
    });

    it('mobile.twitter.com も変換する', async () => {
      const msg = createMessage('https://mobile.twitter.com/user/status/789');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('ツイート内容', 'text/html'));
      summarizeUrl.mockResolvedValue('ツイートの要約');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://fxtwitter.com/user/status/789');
    });

    it('x.com 以外のドメインは変換しない', async () => {
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://example.com/page');
    });

    it('notx.com のようなドメインは変換しない', async () => {
      const msg = createMessage('https://notx.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      expect(mockDownloadBuffer).toHaveBeenCalledWith('https://notx.com/page');
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

    it('titleタグをヒントとしてLLMに渡す', async () => {
      const html = '<html><head><title>サイトのタイトル</title></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('タイトル: サイトのタイトル');
    });

    it('meta name="description" をヒントとしてLLMに渡す', async () => {
      const html = '<html><head><meta name="description" content="ページの説明文"></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('説明: ページの説明文');
    });

    it('meta property="og:description" をヒントとしてLLMに渡す', async () => {
      const html = '<html><head><meta property="og:description" content="OGPの説明文"></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('説明: OGPの説明文');
    });

    it('meta name="description" と property="og:description" の両方があれば両方渡す', async () => {
      const html = '<html><head><meta name="description" content="メタ説明"><meta property="og:description" content="OGP説明"></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('説明: メタ説明');
      expect(passedText).toContain('説明: OGP説明');
    });

    it('meta の属性がシングルクォートでも取得できる', async () => {
      const html = "<html><head><meta name='description' content='シングルクォート説明'></head><body><p>本文</p></body></html>";
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('説明: シングルクォート説明');
    });

    it('meta の name/property と content の順序が逆でも取得できる', async () => {
      const html = '<html><head><meta content="逆順の説明" name="description"></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('説明: 逆順の説明');
    });

    it('ヒントがない場合は本文のみ渡す', async () => {
      const html = '<html><head></head><body><p>本文のみ</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).not.toContain('タイトル:');
      expect(passedText).not.toContain('説明:');
      expect(passedText).toContain('本文のみ');
    });

    it('ヒントと本文が区切られている', async () => {
      const html = '<html><head><title>テスト</title></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      // ヒント部分と本文が分かれている
      const hintIndex = passedText.indexOf('タイトル: テスト');
      const bodyIndex = passedText.indexOf('本文');
      expect(hintIndex).toBeLessThan(bodyIndex);
    });

    it('大文字小文字を区別せずメタタグを取得する', async () => {
      const html = '<html><head><TITLE>大文字タイトル</TITLE><META NAME="Description" CONTENT="大文字説明"></head><body><p>本文</p></body></html>';
      const msg = createMessage('https://example.com');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(html, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('タイトル: 大文字タイトル');
      expect(passedText).toContain('説明: 大文字説明');
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

  describe('エンコーディング変換', () => {
    it('Content-Type ヘッダーの charset で Shift_JIS をデコードする', async () => {
      const sjisBuffer = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]); // 「日本語」のShift_JIS
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(sjisBuffer, 'text/plain; charset=shift_jis'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toBe('日本語');
    });

    it('Content-Type ヘッダーの charset で EUC-JP をデコードする', async () => {
      const eucjpBuffer = Buffer.from([0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec]); // 「日本語」のEUC-JP
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(eucjpBuffer, 'text/plain; charset=euc-jp'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toBe('日本語');
    });

    it('HTML の meta charset で Shift_JIS をデコードする', async () => {
      // <meta charset="shift_jis"> + Shift_JIS本文
      const header = Buffer.from('<html><head><meta charset="shift_jis"></head><body>');
      const body = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]); // 「日本語」
      const footer = Buffer.from('</body></html>');
      const sjisHtml = Buffer.concat([header, body, footer]);
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(sjisHtml, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('日本語');
    });

    it('HTML の meta http-equiv で charset を検出する', async () => {
      const header = Buffer.from('<html><head><meta http-equiv="Content-Type" content="text/html; charset=shift_jis"></head><body>');
      const body = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]); // 「日本語」
      const footer = Buffer.from('</body></html>');
      const sjisHtml = Buffer.concat([header, body, footer]);
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(sjisHtml, 'text/html'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('日本語');
    });

    it('Content-Type ヘッダーの charset が HTML の meta charset より優先される', async () => {
      // ヘッダーは UTF-8 を指定、HTML meta は shift_jis を指定
      const utf8Html = '<html><head><meta charset="shift_jis"></head><body>日本語</body></html>';
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult(utf8Html, 'text/html; charset=utf-8'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toContain('日本語');
    });

    it('charset が不明な場合は UTF-8 にフォールバックする', async () => {
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toBe('Hello');
    });

    it('サポートされていない charset の場合は UTF-8 にフォールバックする', async () => {
      const msg = createMessage('https://example.com/page');
      mockDownloadBuffer.mockResolvedValue(createDownloadResult('Hello', 'text/plain; charset=unknown-encoding'));
      summarizeUrl.mockResolvedValue('テスト');
      await callHandler(msg);
      const passedText = summarizeUrl.mock.calls[0][0];
      expect(passedText).toBe('Hello');
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
