import {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  VoiceChannel,
  Message,
  Guild,
  REST,
  Routes
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
import { shouldBotJoin } from './voiceManager';
import { ConnectionManager } from './connectionManager';
import { MessageQueue } from './messageQueue';
import { formatTtsMessage, resolveReplyMention } from './ttsFormatter';
import { loadChannelFilter } from './channelFilter';
import { createReloadableGuildDictionary, saveGuildDictionaryEntry, removeGuildDictionaryEntry } from './dictionary';
import { LastSpeakerTracker, SAME_SPEAKER_THRESHOLD_MS } from './lastSpeakerTracker';
import { createReloadableSpeakerConfig, TtsVoiceConfig, saveUserVoiceSetting, removeUserVoiceSetting } from './speakerConfig';
import { VoiceMemberLog } from './voiceMemberLog';
import { ConfigWatcher } from './configWatcher';
import { ChatClient } from './chatClient';
import { processImage } from './imageProcessor';
import { handleVoiceStateUpdate } from './voiceStateHandler';
import { handleImageSummary } from './imageHandler';
import { handleUrlSummary } from './urlHandler';
import { createCommandRegistry } from './commands/registry';
import * as path from 'path';

dotenv.config();

const config = loadConfig();
const ttsClient = new TtsClient({
  baseUrl: config.ttsBaseUrl,
  model: config.ttsModel,
  apiKey: config.ttsApiKey,
  voice: config.ttsVoice
});
const chatClient = new ChatClient({
  baseUrl: config.chatBaseUrl,
  model: config.chatModel,
  apiKey: config.chatApiKey
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
const configDir = path.join(process.cwd(), 'config');
const channelFilter = loadChannelFilter(path.join(configDir, 'channels.yml'));
const dictionaryPath = path.join(configDir, 'dictionary.yml');
const guildDictionaryPath = path.join(configDir, 'dictionary-guild.yml');
const dictionary = createReloadableGuildDictionary(dictionaryPath, guildDictionaryPath);
const lastSpeakerTracker = new LastSpeakerTracker(SAME_SPEAKER_THRESHOLD_MS);
const speakerConfig = createReloadableSpeakerConfig(path.join(configDir, 'speakers.yml'));
const voiceMemberLog = new VoiceMemberLog(path.join(configDir, 'voice-members.log.yml'));
const configWatcher = new ConfigWatcher(configDir);
configWatcher.on('dictionary.yml', () => dictionary.reloadGlobal());
configWatcher.on('dictionary-guild.yml', () => dictionary.reloadGuild());
configWatcher.on('speakers.yml', () => speakerConfig.reload());

function enqueueTts (guildId: string, text: string, voiceOverrides?: TtsVoiceConfig): void {
  if (!connections.has(guildId)) {
    return;
  }

  messageQueue.enqueue(guildId, async () => {
    const player = connections.getPlayer(guildId);
    if (!player) {
      return;
    }

    console.log(`TTS: ${text}`);
    const audioBuffer = await ttsClient.synthesize(text, voiceOverrides);
    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream);

    player.play(resource);
    try {
      await entersState(player, AudioPlayerStatus.Idle, 30_000);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log(`TTS 中断 (${guildId}): プレイヤーが破棄されました`);
        return;
      }
      throw e;
    }
  }).catch((e: unknown) => {
    console.warn(`TTS スキップ (${guildId}): ${e instanceof Error ? e.message : e}`);
  });
}

function joinAndRegister (guild: Guild, channel: VoiceChannel): void {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator
  });

  const player = createAudioPlayer();
  connection.subscribe(player);
  connections.register(guild.id, connection, player);

  console.log(`ボイスチャンネルに参加: ${channel.name} (${channel.id})`);

  for (const member of channel.members.values()) {
    if (!member.user.bot) {
      voiceMemberLog.record(guild.id, guild.name, member.id, member.displayName);
    }
  }
}

const speakersPath = path.join(configDir, 'speakers.yml');
const commandRegistry = createCommandRegistry(config.ttsBaseUrl, {
  getPlayer: (guildId) => connections.getPlayer(guildId),
  getQueueSize: (guildId) => messageQueue.size(guildId),
  clearQueue: (guildId) => messageQueue.clear(guildId),
  saveDictionaryEntry: async (guildId, from, to) => {
    await saveGuildDictionaryEntry(guildDictionaryPath, guildId, from, to);
    dictionary.reloadGuild();
  },
  removeDictionaryEntry: async (guildId, from) => {
    await removeGuildDictionaryEntry(guildDictionaryPath, guildId, from);
    dictionary.reloadGuild();
  },
  saveVoiceSetting: async (guildId, userId, voice, guildName, userName) => {
    await saveUserVoiceSetting(speakersPath, guildId, userId, voice, guildName, userName);
    speakerConfig.reload();
  },
  removeVoiceSetting: async (guildId, userId) => {
    await removeUserVoiceSetting(speakersPath, guildId, userId);
    speakerConfig.reload();
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log(`ログイン完了: ${c.user.tag}`);

  console.log(`参加ギルド数: ${c.guilds.cache.size}`);
  const rest = new REST().setToken(config.discordToken);

  c.guilds.cache.forEach(async (g) => {
    console.log(`  ギルド: ${g.name} (${g.id})`);

    await rest.put(Routes.applicationGuildCommands(c.user.id, g.id), { body: commandRegistry.commandBody });
    console.log(`  スラッシュコマンドを登録: ${g.name}`);

    // 起動時に既にユーザーがいるボイスチャンネルに参加
    for (const channel of g.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildVoice) {
        continue;
      }
      if (connections.has(g.id)) {
        break;
      }
      if (!channelFilter.isAllowed(g.id, channel.id)) {
        continue;
      }
      if (!shouldBotJoin(channel as VoiceChannel, c.user.id)) {
        continue;
      }

      joinAndRegister(g, channel as VoiceChannel);
    }
  });
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState, {
    botUserId: client.user!.id,
    defaultTtsModel: config.ttsModel,
    enqueueTts,
    joinChannel: (state) => joinAndRegister(state.guild, state.channel as VoiceChannel),
    recordMember: (guildId, guildName, memberId, displayName) => {
      voiceMemberLog.record(guildId, guildName, memberId, displayName);
    },
    connections,
    channelFilter,
    lastSpeakerTracker,
    speakerConfig,
    dictionary
  });
});

client.on(Events.InteractionCreate, (interaction) => {
  commandRegistry.handleInteraction(interaction);
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) {
    return;
  }
  if (!message.guild) {
    return;
  }

  if (message.channel.type !== ChannelType.GuildVoice) {
    return;
  }
  if (!connections.has(message.guild.id)) {
    return;
  }

  const botMember = message.guild.members.cache.get(client.user!.id);
  if (!botMember?.voice.channel) {
    return;
  }
  if (message.channel.id !== botMember.voice.channel.id) {
    return;
  }

  let imageCount = 0;
  let videoCount = 0;
  for (const a of message.attachments.values()) {
    if (a.contentType?.startsWith('image/')) {
      imageCount++;
    } else if (a.contentType?.startsWith('video/')) {
      videoCount++;
    }
  }
  const attachments = (imageCount > 0 || videoCount > 0)
    ? { image: imageCount, video: videoCount }
    : undefined;

  let content = message.content;
  const repliedUser = message.mentions.repliedUser;
  if (repliedUser) {
    const repliedMember = message.guild.members.cache.get(repliedUser.id);
    content = resolveReplyMention(content, repliedUser.id, {
      nickname: repliedMember?.nickname ?? null,
      displayName: repliedUser.displayName
    });
  }

  const skipName = lastSpeakerTracker.shouldSkipName(
    message.guild.id, message.author.id, Date.now()
  );
  const guildDict = dictionary.forGuild(message.guild.id);
  const ttsText = formatTtsMessage(content, {
    nickname: message.member?.nickname ?? null,
    displayName: message.author.displayName
  }, guildDict, attachments, skipName);
  if (!ttsText) {
    return;
  }

  const userVoice = speakerConfig.resolve(message.guild.id, message.author.id);
  enqueueTts(message.guild.id, ttsText, userVoice);

  handleImageSummary(message, {
    chatMultiModal: config.chatMultiModal,
    imageCount,
    videoCount,
    userVoice,
    enqueueTts,
    processImage,
    describeImage: (dataUri) => chatClient.describeImage(dataUri)
  });

  handleUrlSummary(message, {
    chatMultiModal: config.chatMultiModal,
    userVoice,
    enqueueTts,
    summarizeUrl: (text) => chatClient.summarizeUrl(text),
    processImage,
    describeImage: (dataUri) => chatClient.describeImage(dataUri)
  });
});

// graceful shutdown
let shuttingDown = false;
async function shutdown () {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log('シャットダウン中...');
  configWatcher.close();
  connections.destroyAll();
  // ボイス切断パケットが送信されるまで待機
  await new Promise((resolve) => setTimeout(resolve, 500));
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(config.discordToken);
