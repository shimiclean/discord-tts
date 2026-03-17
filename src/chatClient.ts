import OpenAI from 'openai';

export interface ChatClientOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export class ChatClient {
  private client: OpenAI;
  private model: string;

  constructor (options: ChatClientOptions) {
    this.client = new OpenAI({
      baseURL: options.baseUrl,
      apiKey: options.apiKey
    });
    this.model = options.model;
  }

  async describeImage (dataUri: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUri }
            },
            {
              type: 'text',
              text: 'この画像の内容を日本語で簡潔に説明してください。'
            }
          ]
        }
      ]
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
