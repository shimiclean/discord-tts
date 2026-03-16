import OpenAI from 'openai';

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

  async synthesize (text: string): Promise<Buffer> {
    if (!text || text.trim() === '') {
      throw new Error('Input text must not be empty');
    }

    const response = await this.client.audio.speech.create({
      model: this.model,
      input: text,
      voice: this.voice
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
