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

  it('APIエラーがそのまま伝播される', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    const client = new TtsClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'tts-1',
      apiKey: 'test-key',
      voice: 'alloy'
    });

    await expect(client.synthesize('hello')).rejects.toThrow('API rate limit');
  });
});
