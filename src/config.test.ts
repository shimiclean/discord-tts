import { loadConfig } from './config';

describe('loadConfig', () => {
  const validEnv = {
    DISCORD_TOKEN: 'test-discord-token',
    TTS_BASE_URL: 'https://api.example.com/v1',
    TTS_MODEL: 'tts-1',
    TTS_API_KEY: 'test-api-key',
    TTS_VOICE: 'alloy',
    CHAT_BASE_URL: 'https://chat.example.com/v1',
    CHAT_MODEL: 'gpt-4o',
    CHAT_API_KEY: 'chat-key'
  };

  it('全ての必須環境変数が設定されている場合、設定オブジェクトを返す', () => {
    const config = loadConfig(validEnv);
    expect(config).toEqual({
      discordToken: 'test-discord-token',
      ttsBaseUrl: 'https://api.example.com/v1',
      ttsModel: 'tts-1',
      ttsApiKey: 'test-api-key',
      ttsVoice: 'alloy',
      chatBaseUrl: 'https://chat.example.com/v1',
      chatModel: 'gpt-4o',
      chatApiKey: 'chat-key'
    });
  });

  it.each([
    'DISCORD_TOKEN', 'TTS_BASE_URL', 'TTS_MODEL', 'TTS_API_KEY', 'TTS_VOICE',
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY'
  ])(
    '%s が未設定の場合、例外を投げる',
    (key) => {
      const env = { ...validEnv };
      delete env[key as keyof typeof env];
      expect(() => loadConfig(env)).toThrow(key);
    }
  );

  it.each([
    'DISCORD_TOKEN', 'TTS_BASE_URL', 'TTS_MODEL', 'TTS_API_KEY', 'TTS_VOICE',
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY'
  ])(
    '%s が空文字の場合、例外を投げる',
    (key) => {
      const env = { ...validEnv, [key]: '' };
      expect(() => loadConfig(env)).toThrow(key);
    }
  );

  it.each([
    'DISCORD_TOKEN', 'TTS_BASE_URL', 'TTS_MODEL', 'TTS_API_KEY', 'TTS_VOICE',
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY'
  ])(
    '%s が空白のみの場合、例外を投げる',
    (key) => {
      const env = { ...validEnv, [key]: '   ' };
      expect(() => loadConfig(env)).toThrow(key);
    }
  );

  it('不要な環境変数は無視される', () => {
    const env = { ...validEnv, EXTRA_VAR: 'ignored' };
    const config = loadConfig(env);
    expect(config.discordToken).toBe('test-discord-token');
    expect(config.chatBaseUrl).toBe('https://chat.example.com/v1');
  });
});
