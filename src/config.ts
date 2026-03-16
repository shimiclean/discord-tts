export interface Config {
  discordToken: string;
  ttsBaseUrl: string;
  ttsModel: string;
  ttsApiKey: string;
}

const REQUIRED_KEYS = [
  "DISCORD_TOKEN",
  "TTS_BASE_URL",
  "TTS_MODEL",
  "TTS_API_KEY",
] as const;

export function loadConfig(
  env: Record<string, string | undefined> = process.env
): Config {
  for (const key of REQUIRED_KEYS) {
    const value = env[key];
    if (!value || value.trim() === "") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    discordToken: env.DISCORD_TOKEN!.trim(),
    ttsBaseUrl: env.TTS_BASE_URL!.trim(),
    ttsModel: env.TTS_MODEL!.trim(),
    ttsApiKey: env.TTS_API_KEY!.trim(),
  };
}
