import { downloadBuffer } from './downloader';

const mockFetch = jest.spyOn(global, 'fetch');

describe('downloadBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('URL からデータをダウンロードして Buffer を返す', async () => {
    const body = Buffer.from('テストデータ');
    mockFetch.mockResolvedValue(new Response(body, { status: 200 }));

    const result = await downloadBuffer('https://example.com/data');

    expect(Buffer.compare(result, body)).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/data');
  });

  it('レスポンスヘッダーの content-type を返す', async () => {
    const body = Buffer.from('<html></html>');
    mockFetch.mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    }));

    const result = await downloadBuffer('https://example.com/page');

    expect(result.contentType).toBe('text/html; charset=utf-8');
  });

  it('content-type ヘッダーがない場合は空文字を返す', async () => {
    const body = Buffer.from('data');
    const response = new Response(body, { status: 200 });
    response.headers.delete('content-type');
    mockFetch.mockResolvedValue(response);

    const result = await downloadBuffer('https://example.com/data');

    expect(result.contentType).toBe('');
  });

  it('HTTP レスポンスがエラーの場合はエラーを投げる', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(downloadBuffer('https://example.com/missing'))
      .rejects.toThrow('ダウンロードに失敗: HTTP 404');
  });

  it('HTTP 500 エラーの場合もエラーを投げる', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(downloadBuffer('https://example.com/error'))
      .rejects.toThrow('ダウンロードに失敗: HTTP 500');
  });

  it('ネットワークエラーの場合はエラーを伝播する', async () => {
    mockFetch.mockRejectedValue(new Error('ネットワークエラー'));

    await expect(downloadBuffer('https://example.com/fail'))
      .rejects.toThrow('ネットワークエラー');
  });
});
