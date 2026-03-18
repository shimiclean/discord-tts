import { ChatClient } from './chatClient';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('ChatClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('画像の data URI とプロンプトを正しいパラメータで送信する', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '猫が寝ている写真' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'https://cdn.discordapp.com/attachments/123/456/image.png' }
            },
            {
              type: 'text',
              text: 'この画像を50文字以内の日本語で説明して。体言止めで、前置きや装飾は不要。'
            }
          ]
        }
      ]
    });
  });

  it('API レスポンスからテキストを返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '猫が寝ている写真' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('猫が寝ている写真');
  });

  it('レスポンスの content が null の場合は空文字を返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('');
  });

  it('choices が空の場合は空文字を返す', async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('');
  });

  it('Reasoning モデルの think タグを除去して本文のみ返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '<think>\nこれは猫の画像です。寝ているようです。\n</think>\n猫が寝ている写真' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('猫が寝ている写真');
  });

  it('think 閉じタグのみの場合も正しく除去する', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '</think>\n猫が寝ている写真' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('猫が寝ている写真');
  });

  it('think タグがない通常のレスポンスはそのまま返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '猫が寝ている写真' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('猫が寝ている写真');
  });

  it('think タグ除去後に空になった場合は空文字を返す', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '<think>\nこれは猫です\n</think>' } }]
    });

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    const result = await client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png');
    expect(result).toBe('');
  });

  it('API エラーがそのまま伝播される', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    const client = new ChatClient({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o',
      apiKey: 'test-key'
    });

    await expect(client.describeImage('https://cdn.discordapp.com/attachments/123/456/image.png'))
      .rejects.toThrow('API rate limit');
  });
});
