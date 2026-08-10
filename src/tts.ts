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

  // オーバーライドとデフォルトから実際に合成に使う model / voice を決める
  resolveVoice (overrides?: TtsVoiceConfig): { model: string; voice: string } {
    return {
      model: overrides?.model ?? this.model,
      voice: overrides?.voice ?? this.voice
    };
  }

  async synthesize (text: string, overrides?: TtsVoiceConfig): Promise<Buffer> {
    if (!text || text.trim() === '') {
      throw new Error('Input text must not be empty');
    }

    const { model, voice } = this.resolveVoice(overrides);
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
