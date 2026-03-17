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
    CHAT_API_KEY: 'chat-key',
    CHAT_MULTI_MODAL: 'false'
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
      chatApiKey: 'chat-key',
      chatMultiModal: false
    });
  });

  it.each([
    'DISCORD_TOKEN', 'TTS_BASE_URL', 'TTS_MODEL', 'TTS_API_KEY', 'TTS_VOICE',
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY', 'CHAT_MULTI_MODAL'
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
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY', 'CHAT_MULTI_MODAL'
  ])(
    '%s が空文字の場合、例外を投げる',
    (key) => {
      const env = { ...validEnv, [key]: '' };
      expect(() => loadConfig(env)).toThrow(key);
    }
  );

  it.each([
    'DISCORD_TOKEN', 'TTS_BASE_URL', 'TTS_MODEL', 'TTS_API_KEY', 'TTS_VOICE',
    'CHAT_BASE_URL', 'CHAT_MODEL', 'CHAT_API_KEY', 'CHAT_MULTI_MODAL'
  ])(
    '%s が空白のみの場合、例外を投げる',
    (key) => {
      const env = { ...validEnv, [key]: '   ' };
      expect(() => loadConfig(env)).toThrow(key);
    }
  );

  it('CHAT_MULTI_MODAL が "true" の場合、chatMultiModal が true になる', () => {
    const env = { ...validEnv, CHAT_MULTI_MODAL: 'true' };
    const config = loadConfig(env);
    expect(config.chatMultiModal).toBe(true);
  });

  it('CHAT_MULTI_MODAL が "true" "false" 以外の場合、例外を投げる', () => {
    const env = { ...validEnv, CHAT_MULTI_MODAL: 'yes' };
    expect(() => loadConfig(env)).toThrow('CHAT_MULTI_MODAL');
  });

  it('不要な環境変数は無視される', () => {
    const env = { ...validEnv, EXTRA_VAR: 'ignored' };
    const config = loadConfig(env);
    expect(config.discordToken).toBe('test-discord-token');
    expect(config.chatBaseUrl).toBe('https://chat.example.com/v1');
  });
});
