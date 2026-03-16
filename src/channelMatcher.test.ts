import { findMatchingVoiceChannel } from './channelMatcher';
import { Collection, VoiceChannel, ChannelType } from 'discord.js';

function createMockVoiceChannel (
  id: string,
  name: string
): VoiceChannel {
  return { id, name, type: ChannelType.GuildVoice } as VoiceChannel;
}

describe('findMatchingVoiceChannel', () => {
  it('テキストチャンネルと同名のボイスチャンネルを返す', () => {
    const voiceChannels = new Collection<string, VoiceChannel>();
    voiceChannels.set('1', createMockVoiceChannel('1', 'general'));
    voiceChannels.set('2', createMockVoiceChannel('2', 'music'));

    const result = findMatchingVoiceChannel('general', voiceChannels);
    expect(result).toBeDefined();
    expect(result!.id).toBe('1');
    expect(result!.name).toBe('general');
  });

  it('一致するボイスチャンネルがない場合、undefinedを返す', () => {
    const voiceChannels = new Collection<string, VoiceChannel>();
    voiceChannels.set('1', createMockVoiceChannel('1', 'general'));

    const result = findMatchingVoiceChannel('random', voiceChannels);
    expect(result).toBeUndefined();
  });

  it('ボイスチャンネルが空の場合、undefinedを返す', () => {
    const voiceChannels = new Collection<string, VoiceChannel>();

    const result = findMatchingVoiceChannel('general', voiceChannels);
    expect(result).toBeUndefined();
  });

  it('部分一致ではなく完全一致で判定する', () => {
    const voiceChannels = new Collection<string, VoiceChannel>();
    voiceChannels.set('1', createMockVoiceChannel('1', 'general-voice'));

    const result = findMatchingVoiceChannel('general', voiceChannels);
    expect(result).toBeUndefined();
  });

  it('複数のボイスチャンネルから正しいものを返す', () => {
    const voiceChannels = new Collection<string, VoiceChannel>();
    voiceChannels.set('1', createMockVoiceChannel('1', 'alpha'));
    voiceChannels.set('2', createMockVoiceChannel('2', 'beta'));
    voiceChannels.set('3', createMockVoiceChannel('3', 'gamma'));

    const result = findMatchingVoiceChannel('beta', voiceChannels);
    expect(result).toBeDefined();
    expect(result!.id).toBe('2');
  });
});
