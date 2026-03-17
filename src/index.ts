import {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  VoiceChannel,
  Message
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState
} from '@discordjs/voice';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { loadConfig } from './config';
import { TtsClient } from './tts';
import { shouldBotJoin, shouldBotLeave } from './voiceManager';
import { ConnectionManager } from './connectionManager';
import { MessageQueue } from './messageQueue';
import { formatTtsMessage, formatJoinMessage, formatLeaveMessage } from './ttsFormatter';
import { loadChannelFilter } from './channelFilter';
import { createReloadableDictionary } from './dictionary';
import { LastSpeakerTracker, SAME_SPEAKER_THRESHOLD_MS } from './lastSpeakerTracker';
import { createReloadableSpeakerConfig, TtsVoiceConfig } from './speakerConfig';
import { VoiceMemberLog } from './voiceMemberLog';
import * as path from 'path';

dotenv.config();

const config = loadConfig();
const ttsClient = new TtsClient({
  baseUrl: config.ttsBaseUrl,
  model: config.ttsModel,
  apiKey: config.ttsApiKey,
  voice: config.ttsVoice
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const connections = new ConnectionManager();
const messageQueue = new MessageQueue();
const channelFilter = loadChannelFilter(path.join(process.cwd(), 'channels.yml'));
const dictionary = createReloadableDictionary(path.join(process.cwd(), 'dictionary.yml'));
const lastSpeakerTracker = new LastSpeakerTracker(SAME_SPEAKER_THRESHOLD_MS);
const speakerConfig = createReloadableSpeakerConfig(path.join(process.cwd(), 'speakers.yml'));
const voiceMemberLog = new VoiceMemberLog(path.join(process.cwd(), 'voice-members.log.yml'));

function enqueueTts (guildId: string, text: string, voiceOverrides?: TtsVoiceConfig): void {
  if (!connections.has(guildId)) return;

  messageQueue.enqueue(guildId, async () => {
    const player = connections.getPlayer(guildId);
    if (!player) return;

    console.log(`TTS: ${text}`);
    const audioBuffer = await ttsClient.synthesize(text, voiceOverrides);
    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream);

    player.play(resource);
    await entersState(player, AudioPlayerStatus.Idle, 30_000);
  }).catch((e: unknown) => {
    console.warn(`TTS スキップ (${guildId}): ${e instanceof Error ? e.message : e}`);
  });
}

client.once(Events.ClientReady, (c) => {
  console.log(`ログイン完了: ${c.user.tag}`);
  console.log(`参加ギルド数: ${c.guilds.cache.size}`);
  c.guilds.cache.forEach((g) => {
    console.log(`  ギルド: ${g.name} (${g.id})`);

    // 起動時に既にユーザーがいるボイスチャンネルに参加
    for (const channel of g.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildVoice) continue;
      if (connections.has(g.id)) break;
      if (!channelFilter.isAllowed(g.id, channel.id)) continue;
      if (!shouldBotJoin(channel as VoiceChannel, c.user.id)) continue;

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: g.id,
        adapterCreator: g.voiceAdapterCreator
      });

      const player = createAudioPlayer();
      connection.subscribe(player);
      connections.register(g.id, connection, player);

      console.log(`ボイスチャンネルに参加: ${channel.name} (${channel.id})`);

      // 既存メンバーを記録
      for (const member of (channel as VoiceChannel).members.values()) {
        if (!member.user.bot) {
          voiceMemberLog.record(g.id, g.name, member.id, member.displayName);
        }
      }
    }
  });
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.member?.user.bot) return;

  // チャンネルが変わっていない場合は無視（配信開始、ミュート切替など）
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member!;
  const user = {
    nickname: member.nickname,
    displayName: member.displayName
  };

  // ユーザーがボイスチャンネルから退出した場合（joinより先に処理する）
  if (oldState.channel && oldState.channel.type === ChannelType.GuildVoice) {
    if (shouldBotLeave(oldState.channel as VoiceChannel, client.user!.id)) {
      connections.remove(oldState.guild.id);
      lastSpeakerTracker.clear(oldState.guild.id);
      console.log(`ボイスチャンネルから退出: ${oldState.channel.name} (${oldState.channel.id})`);
    } else if (connections.has(oldState.guild.id)) {
      const systemVoice = speakerConfig.resolve(oldState.guild.id, 'system');
      enqueueTts(oldState.guild.id, formatLeaveMessage(user, systemVoice.model ?? config.ttsModel, dictionary), systemVoice);
    }
  }

  // ユーザーがボイスチャンネルに参加した場合
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) {
    if (!connections.has(newState.guild.id) &&
        channelFilter.isAllowed(newState.guild.id, newState.channel.id) &&
        shouldBotJoin(newState.channel as VoiceChannel, client.user!.id)) {
      const connection = joinVoiceChannel({
        channelId: newState.channel.id,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator
      });

      const player = createAudioPlayer();
      connection.subscribe(player);
      connections.register(newState.guild.id, connection, player);

      console.log(`ボイスチャンネルに参加: ${newState.channel.name} (${newState.channel.id})`);

      // 既存メンバーを記録
      for (const m of (newState.channel as VoiceChannel).members.values()) {
        if (!m.user.bot) {
          voiceMemberLog.record(newState.guild.id, newState.guild.name, m.id, m.displayName);
        }
      }
    }

    if (connections.has(newState.guild.id)) {
      voiceMemberLog.record(newState.guild.id, newState.guild.name, member.id, member.displayName);
      const systemVoice = speakerConfig.resolve(newState.guild.id, 'system');
      enqueueTts(newState.guild.id, formatJoinMessage(user, systemVoice.model ?? config.ttsModel, dictionary), systemVoice);
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.channel.type !== ChannelType.GuildVoice) return;
  if (!connections.has(message.guild.id)) return;

  const botMember = message.guild.members.cache.get(client.user!.id);
  if (!botMember?.voice.channel) return;
  if (message.channel.id !== botMember.voice.channel.id) return;

  const attachmentType = message.attachments.some(
    (a) => a.contentType?.startsWith('image/') ?? false
  )
    ? 'image' as const
    : message.attachments.some(
      (a) => a.contentType?.startsWith('video/') ?? false
    )
      ? 'video' as const
      : undefined;
  const skipName = lastSpeakerTracker.shouldSkipName(
    message.guild.id, message.author.id, Date.now()
  );
  const ttsText = formatTtsMessage(message.content, {
    nickname: message.member?.nickname ?? null,
    displayName: message.author.displayName
  }, dictionary, attachmentType, skipName);
  if (!ttsText) return;

  const userVoice = speakerConfig.resolve(message.guild.id, message.author.id);
  enqueueTts(message.guild.id, ttsText, userVoice);
});

// graceful shutdown
let shuttingDown = false;
async function shutdown () {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('シャットダウン中...');
  dictionary.close();
  speakerConfig.close();
  connections.destroyAll();
  // ボイス切断パケットが送信されるまで待機
  await new Promise((resolve) => setTimeout(resolve, 500));
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(config.discordToken);
