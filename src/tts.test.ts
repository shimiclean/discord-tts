import { TtsClient } from './tts';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        speech: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('TtsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('正しいパラメータでOpenAI APIを呼び出す', async () => {
    const mockBuffer = Buffer.from('audio-data');
    const mockResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
    };
    mockCreate.mockResolvedValue(mockResponse);

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'nova'
    });

    await client.synthesize('hello world');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'tts-1',
      input: 'hello world',
      voice: 'nova'
    });
  });

  it('音声データを含むBufferを返す', async () => {
    const audioData = new Uint8Array([1, 2, 3, 4]).buffer;
    const mockResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(audioData)
    };
    mockCreate.mockResolvedValue(mockResponse);

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    const result = await client.synthesize('test');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(audioData));
  });

  it('入力テキストが空文字の場合、例外を投げる', async () => {
    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await expect(client.synthesize('')).rejects.toThrow('empty');
  });

  it('入力テキストが空白のみの場合、例外を投げる', async () => {
    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await expect(client.synthesize('   ')).rejects.toThrow('empty');
  });

  it('オーバーライドで model と voice を上書きできる', async () => {
    const mockBuffer = Buffer.from('audio-data');
    const mockResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
    };
    mockCreate.mockResolvedValue(mockResponse);

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'nova'
    });

    await client.synthesize('hello', { model: 'zundamon', voice: 'shimmer' });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'zundamon',
      input: 'hello',
      voice: 'shimmer'
    });
  });

  it('オーバーライドで model のみ指定した場合はコンストラクタの voice を使う', async () => {
    const mockBuffer = Buffer.from('audio-data');
    const mockResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
    };
    mockCreate.mockResolvedValue(mockResponse);

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'nova'
    });

    await client.synthesize('hello', { model: 'zundamon' });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'zundamon',
      input: 'hello',
      voice: 'nova'
    });
  });

  it('オーバーライドで voice のみ指定した場合はコンストラクタの model を使う', async () => {
    const mockBuffer = Buffer.from('audio-data');
    const mockResponse = {
      arrayBuffer: jest.fn().mockResolvedValue(mockBuffer.buffer)
    };
    mockCreate.mockResolvedValue(mockResponse);

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'nova'
    });

    await client.synthesize('hello', { voice: 'shimmer' });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'tts-1',
      input: 'hello',
      voice: 'shimmer'
    });
  });

  it('3回リトライしてすべて失敗した場合はAPIエラーが伝播される', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await expect(client.synthesize('hello')).rejects.toThrow('API rate limit');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('一時的なAPIエラーの後にリトライして成功する', async () => {
    const audioData = new Uint8Array([1, 2, 3, 4]).buffer;
    mockCreate
      .mockRejectedValueOnce(new Error('一時的なエラー'))
      .mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(audioData) });

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    const result = await client.synthesize('hello');
    expect(result).toEqual(Buffer.from(audioData));
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('レスポンスの読み取りに失敗した場合もリトライする', async () => {
    const audioData = new Uint8Array([5, 6]).buffer;
    mockCreate
      .mockResolvedValueOnce({ arrayBuffer: jest.fn().mockRejectedValue(new Error('読み取り失敗')) })
      .mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(audioData) });

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    const result = await client.synthesize('hello');
    expect(result).toEqual(Buffer.from(audioData));
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('成功した場合はリトライしない', async () => {
    const audioData = new Uint8Array([1, 2, 3, 4]).buffer;
    mockCreate.mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(audioData) });

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await client.synthesize('hello');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('入力テキストが空の場合はリトライせずAPIを呼ばない', async () => {
    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await expect(client.synthesize('')).rejects.toThrow('empty');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
