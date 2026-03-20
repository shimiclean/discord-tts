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

  async summarizeUrl (text: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: `以下のウェブページの内容を100文字程度の日本語で要約して。このページが何のページか分かるように。前置きや装飾は不要。\n\n${text}`
        }
      ]
    });

    const raw = response.choices[0]?.message?.content ?? '';
    return stripThinkTag(raw);
  }

  async describeImage (imageUrl: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
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
              text: 'この画像を50文字以内の日本語で説明して。体言止めで、前置きや装飾は不要。'
            }
          ]
        }
      ]
    });

    const raw = response.choices[0]?.message?.content ?? '';
    return stripThinkTag(raw);
  }
}

function stripThinkTag (text: string): string {
  const idx = text.indexOf('</think>');
  if (idx === -1) {
    return text;
  }
  return text.slice(idx + '</think>'.length).trim();
}
