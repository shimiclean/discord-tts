import { processImage } from './imageProcessor';

// sharp のモック
const mockToBuffer = jest.fn();
const mockJpeg = jest.fn(() => ({ toBuffer: mockToBuffer }));
const mockFlatten = jest.fn(() => ({ jpeg: mockJpeg }));
const mockResize = jest.fn(() => ({ flatten: mockFlatten }));
const mockSharp = jest.fn(() => ({ resize: mockResize }));
jest.mock('sharp', () => {
  const fn = (input: Buffer) => (mockSharp as any)(input);
  return { __esModule: true, default: fn };
});

// downloader のモック
const mockDownloadBuffer = jest.fn();
jest.mock('./downloader', () => ({
  downloadBuffer: (...args: unknown[]) => mockDownloadBuffer(...args)
}));

describe('processImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('画像をダウンロードしてリサイズ・JPEG変換し、data URI を返す', async () => {
    const inputBuffer = Buffer.from('fake-image-input');
    const outputBuffer = Buffer.from('fake-jpeg-output');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockToBuffer.mockResolvedValue(outputBuffer);

    const result = await processImage('https://cdn.example.com/image.png');

    const expectedBase64 = outputBuffer.toString('base64');
    expect(result).toBe(`data:image/jpeg;base64,${expectedBase64}`);
  });

  it('sharp に正しいリサイズオプションを渡す', async () => {
    const inputBuffer = Buffer.from('fake-image-input');
    const outputBuffer = Buffer.from('fake-jpeg-output');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockToBuffer.mockResolvedValue(outputBuffer);

    await processImage('https://cdn.example.com/image.png');

    expect(mockSharp).toHaveBeenCalledWith(inputBuffer);
    expect(mockResize).toHaveBeenCalledWith(1000, 1000, {
      fit: 'inside',
      withoutEnlargement: true
    });
    expect(mockFlatten).toHaveBeenCalledWith({ background: '#ffffff' });
    expect(mockJpeg).toHaveBeenCalledWith();
  });

  it('ダウンロードに失敗した場合はエラーを伝播する', async () => {
    mockDownloadBuffer.mockRejectedValue(new Error('ダウンロードに失敗: HTTP 404'));

    await expect(processImage('https://cdn.example.com/image.png'))
      .rejects.toThrow('ダウンロードに失敗: HTTP 404');
  });

  it('sharp の変換に失敗した場合はエラーを伝播する', async () => {
    const inputBuffer = Buffer.from('fake-image-input');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockToBuffer.mockRejectedValue(new Error('Input buffer contains unsupported image format'));

    await expect(processImage('https://cdn.example.com/image.png'))
      .rejects.toThrow('Input buffer contains unsupported image format');
  });
});
