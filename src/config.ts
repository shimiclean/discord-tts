export interface Config {
  discordToken: string;
  ttsBaseUrl: string;
  ttsModel: string;
  ttsApiKey: string;
  ttsVoice: string;
  chatBaseUrl: string;
  chatModel: string;
  chatApiKey: string;
  chatMultiModal: boolean;
}

const REQUIRED_KEYS = [
  'DISCORD_TOKEN',
  'TTS_BASE_URL',
  'TTS_MODEL',
  'TTS_API_KEY',
  'TTS_VOICE',
  'CHAT_BASE_URL',
  'CHAT_MODEL',
  'CHAT_API_KEY',
  'CHAT_MULTI_MODAL'
] as const;

function parseBooleanEnv (key: string, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  throw new Error(`${key} must be "true" or "false", got "${trimmed}"`);
}

export function loadConfig (
  env: Record<string, string | undefined> = process.env
): Config {
  for (const key of REQUIRED_KEYS) {
    const value = env[key];
    if (!value || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    discordToken: env.DISCORD_TOKEN!.trim(),
    ttsBaseUrl: env.TTS_BASE_URL!.trim(),
    ttsModel: env.TTS_MODEL!.trim(),
    ttsApiKey: env.TTS_API_KEY!.trim(),
    ttsVoice: env.TTS_VOICE!.trim(),
    chatBaseUrl: env.CHAT_BASE_URL!.trim(),
    chatModel: env.CHAT_MODEL!.trim(),
    chatApiKey: env.CHAT_API_KEY!.trim(),
    chatMultiModal: parseBooleanEnv('CHAT_MULTI_MODAL', env.CHAT_MULTI_MODAL!)
  };
}
