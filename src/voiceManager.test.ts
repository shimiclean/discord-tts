import { shouldBotJoin, shouldBotLeave } from './voiceManager';
import { VoiceChannel, GuildMember } from 'discord.js';

function createMockMember (id: string, isBot: boolean): GuildMember {
  return { id, user: { bot: isBot } } as unknown as GuildMember;
}

function createMockVoiceChannel (
  members: GuildMember[]
): VoiceChannel {
  const collection = new Map(members.map((m) => [m.id, m]));
  return { members: collection } as unknown as VoiceChannel;
}

describe('shouldBotJoin', () => {
  it('人間のユーザーがいてBotがいない場合、trueを返す', () => {
    const user = createMockMember('user1', false);
    const channel = createMockVoiceChannel([user]);
    const botId = 'bot1';

    expect(shouldBotJoin(channel, botId)).toBe(true);
  });

  it('Botしかいない場合、falseを返す', () => {
    const bot = createMockMember('bot2', true);
    const channel = createMockVoiceChannel([bot]);
    const botId = 'bot1';

    expect(shouldBotJoin(channel, botId)).toBe(false);
  });

  it('Botが既にチャンネルにいる場合、falseを返す', () => {
    const user = createMockMember('user1', false);
    const bot = createMockMember('bot1', true);
    const channel = createMockVoiceChannel([user, bot]);
    const botId = 'bot1';

    expect(shouldBotJoin(channel, botId)).toBe(false);
  });

  it('複数の人間のユーザーがいてBotがいない場合、trueを返す', () => {
    const user1 = createMockMember('user1', false);
    const user2 = createMockMember('user2', false);
    const channel = createMockVoiceChannel([user1, user2]);
    const botId = 'bot1';

    expect(shouldBotJoin(channel, botId)).toBe(true);
  });
});

describe('shouldBotLeave', () => {
  it('Botだけが残っている場合、trueを返す', () => {
    const bot = createMockMember('bot1', true);
    const channel = createMockVoiceChannel([bot]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(true);
  });

  it('人間のユーザーがまだいる場合、falseを返す', () => {
    const user = createMockMember('user1', false);
    const bot = createMockMember('bot1', true);
    const channel = createMockVoiceChannel([user, bot]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(false);
  });

  it('チャンネルが空の場合、falseを返す（Botも既にいない）', () => {
    const channel = createMockVoiceChannel([]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(false);
  });

  it('Botのみが複数残っている場合、trueを返す', () => {
    const bot1 = createMockMember('bot1', true);
    const bot2 = createMockMember('bot2', true);
    const channel = createMockVoiceChannel([bot1, bot2]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(true);
  });

  it('人間が1人でも残っている場合、falseを返す', () => {
    const user = createMockMember('user1', false);
    const bot1 = createMockMember('bot1', true);
    const bot2 = createMockMember('bot2', true);
    const channel = createMockVoiceChannel([user, bot1, bot2]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(false);
  });

  it('自Botがチャンネルにいない場合、falseを返す（別チャンネルへ移動済み）', () => {
    const channel = createMockVoiceChannel([]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(false);
  });

  it('自Botがいない状態で他Botだけ残っている場合、falseを返す', () => {
    const otherBot = createMockMember('bot2', true);
    const channel = createMockVoiceChannel([otherBot]);
    const botId = 'bot1';

    expect(shouldBotLeave(channel, botId)).toBe(false);
  });
});
