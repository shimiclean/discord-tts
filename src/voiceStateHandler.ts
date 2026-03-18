import { VoiceState, ChannelType, VoiceChannel } from 'discord.js';
import { shouldBotJoin, shouldBotLeave } from './voiceManager';
import { formatStateMessage } from './ttsFormatter';
import { TtsVoiceConfig } from './speakerConfig';
import { Dictionary } from './dictionary';

export interface VoiceStateHandlerDeps {
  botUserId: string;
  defaultTtsModel: string;
  enqueueTts: (guildId: string, text: string, voice: TtsVoiceConfig) => void;
  joinChannel: (newState: VoiceState) => void;
  recordMember: (guildId: string, guildName: string, memberId: string, displayName: string) => void;
  connections: {
    has(guildId: string): boolean;
    remove(guildId: string): void;
  };
  channelFilter: {
    isAllowed(guildId: string, channelId: string): boolean;
  };
  lastSpeakerTracker: {
    clear(guildId: string): void;
  };
  speakerConfig: {
    resolve(guildId: string, userId: string): TtsVoiceConfig;
  };
  dictionary: Dictionary;
}

export function handleVoiceStateUpdate (
  oldState: VoiceState,
  newState: VoiceState,
  deps: VoiceStateHandlerDeps
): void {
  if (newState.member?.user.bot) {
    return;
  }

  // チャンネルが変わっていない場合は状態変化（配信・カメラ）のみ処理
  if (oldState.channelId === newState.channelId) {
    handleStateChange(oldState, newState, deps);
    return;
  }

  handleChannelChange(oldState, newState, deps);
}

function handleStateChange (
  oldState: VoiceState,
  newState: VoiceState,
  deps: VoiceStateHandlerDeps
): void {
  if (!newState.channel || !deps.connections.has(newState.guild.id)) {
    return;
  }

  const member = newState.member!;
  const user = {
    nickname: member.nickname,
    displayName: member.displayName
  };
  const systemVoice = deps.speakerConfig.resolve(newState.guild.id, 'system');
  const model = systemVoice.model ?? deps.defaultTtsModel;

  if (!oldState.streaming && newState.streaming) {
    deps.enqueueTts(newState.guild.id, formatStateMessage('streamStart', user, model, deps.dictionary), systemVoice);
  } else if (oldState.streaming && !newState.streaming) {
    deps.enqueueTts(newState.guild.id, formatStateMessage('streamEnd', user, model, deps.dictionary), systemVoice);
  }

  if (!oldState.selfVideo && newState.selfVideo) {
    deps.enqueueTts(newState.guild.id, formatStateMessage('cameraOn', user, model, deps.dictionary), systemVoice);
  } else if (oldState.selfVideo && !newState.selfVideo) {
    deps.enqueueTts(newState.guild.id, formatStateMessage('cameraOff', user, model, deps.dictionary), systemVoice);
  }
}

function handleChannelChange (
  oldState: VoiceState,
  newState: VoiceState,
  deps: VoiceStateHandlerDeps
): void {
  const member = newState.member!;
  const user = {
    nickname: member.nickname,
    displayName: member.displayName
  };

  // ユーザーがボイスチャンネルから退出した場合（joinより先に処理する）
  if (oldState.channel && oldState.channel.type === ChannelType.GuildVoice) {
    if (shouldBotLeave(oldState.channel as VoiceChannel, deps.botUserId)) {
      deps.connections.remove(oldState.guild.id);
      deps.lastSpeakerTracker.clear(oldState.guild.id);
      console.log(`ボイスチャンネルから退出: ${oldState.channel.name} (${oldState.channel.id})`);
    } else if (deps.connections.has(oldState.guild.id)) {
      const systemVoice = deps.speakerConfig.resolve(oldState.guild.id, 'system');
      deps.enqueueTts(oldState.guild.id, formatStateMessage('leave', user, systemVoice.model ?? deps.defaultTtsModel, deps.dictionary), systemVoice);
    }
  }

  // ユーザーがボイスチャンネルに参加した場合
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) {
    if (
      !deps.connections.has(newState.guild.id) &&
      deps.channelFilter.isAllowed(newState.guild.id, newState.channel.id) &&
      shouldBotJoin(newState.channel as VoiceChannel, deps.botUserId)
    ) {
      deps.joinChannel(newState);
    }

    if (deps.connections.has(newState.guild.id)) {
      deps.recordMember(newState.guild.id, newState.guild.name, member.id, member.displayName);
      const systemVoice = deps.speakerConfig.resolve(newState.guild.id, 'system');
      deps.enqueueTts(newState.guild.id, formatStateMessage('join', user, systemVoice.model ?? deps.defaultTtsModel, deps.dictionary), systemVoice);
    }
  }
}
