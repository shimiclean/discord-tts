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

  async describeImage (imageUrl: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: 'この画像を20文字以内の日本語で説明して。体言止めで、前置きや装飾は不要。'
            }
          ]
        }
      ]
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
