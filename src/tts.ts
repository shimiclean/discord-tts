import OpenAI from 'openai';
import { TtsVoiceConfig } from './speakerConfig';
import { withRetryResult } from './retry';

export interface TtsClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  voice: string;
}

export class TtsClient {
  private client: OpenAI;
  private model: string;
  private voice: string;

  constructor (options: TtsClientOptions) {
    this.client = new OpenAI({
      baseURL: options.baseUrl,
      apiKey: options.apiKey
    });
    this.model = options.model;
    this.voice = options.voice;
  }

  async synthesize (text: string, overrides?: TtsVoiceConfig): Promise<Buffer> {
    if (!text || text.trim() === '') {
      throw new Error('Input text must not be empty');
    }

    const model = overrides?.model ?? this.model;
    const voice = overrides?.voice ?? this.voice;
    console.log(`[TTS] model=${model} voice=${voice} text="${text}"`);

    // 一時的な API エラーで発言が丸ごと失われないようリトライする
    return withRetryResult(async () => {
      const response = await this.client.audio.speech.create({
        model,
        input: text,
        voice
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    });
  }
}
