import {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  VoiceChannel,
  TextChannel,
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

function enqueueTts (guildId: string, text: string): void {
  const player = connections.getPlayer(guildId);
  if (!player) return;

  messageQueue.enqueue(guildId, async () => {
    const audioBuffer = await ttsClient.synthesize(text);
    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream);

    player.play(resource);
    await entersState(player, AudioPlayerStatus.Idle, 30_000);
  });
}

client.once(Events.ClientReady, (c) => {
  console.log(`ログイン完了: ${c.user.tag}`);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (newState.member?.user.bot) return;

  const member = newState.member!;
  const user = {
    nickname: member.nickname,
    displayName: member.displayName
  };

  // ユーザーがボイスチャンネルから退出した場合（joinより先に処理する）
  if (oldState.channel && oldState.channel.type === ChannelType.GuildVoice) {
    if (shouldBotLeave(oldState.channel as VoiceChannel, client.user!.id)) {
      connections.remove(oldState.guild.id);
      console.log(`ボイスチャンネルから退出: ${oldState.channel.name}`);
    } else if (connections.has(oldState.guild.id)) {
      enqueueTts(oldState.guild.id, formatLeaveMessage(user));
    }
  }

  // ユーザーがボイスチャンネルに参加した場合
  if (newState.channel && newState.channel.type === ChannelType.GuildVoice) {
    if (!connections.has(newState.guild.id) &&
        shouldBotJoin(newState.channel as VoiceChannel, client.user!.id)) {
      const connection = joinVoiceChannel({
        channelId: newState.channel.id,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator
      });

      const player = createAudioPlayer();
      connection.subscribe(player);
      connections.register(newState.guild.id, connection, player);

      console.log(`ボイスチャンネルに参加: ${newState.channel.name}`);
    }

    if (connections.has(newState.guild.id)) {
      enqueueTts(newState.guild.id, formatJoinMessage(user));
    }
  }
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.channel.type !== ChannelType.GuildText) return;

  const textChannel = message.channel as TextChannel;
  if (!connections.has(message.guild.id)) return;

  // Botが現在参加しているボイスチャンネルを取得
  const botMember = message.guild.members.cache.get(client.user!.id);
  if (!botMember?.voice.channel) return;

  // テキストチャンネル名とボイスチャンネル名が一致するか確認
  if (textChannel.name !== botMember.voice.channel.name) return;

  const ttsText = formatTtsMessage(message.content, {
    nickname: message.member?.nickname ?? null,
    displayName: message.author.displayName
  });
  if (!ttsText) return;

  enqueueTts(message.guild.id, ttsText);
});

// graceful shutdown
function shutdown () {
  console.log('シャットダウン中...');
  connections.destroyAll();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(config.discordToken);
