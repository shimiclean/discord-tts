import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';

export type GetQueueSizeFn = (guildId: string) => number;
export type ClearQueueFn = (guildId: string) => number;

export function buildQueueSizeCommand () {
  return new SlashCommandBuilder()
    .setName('queue-size')
    .setDescription('読み上げキューの待機数を表示');
}

export function buildQueueClearCommand () {
  return new SlashCommandBuilder()
    .setName('queue-clear')
    .setDescription('読み上げキューをクリア');
}

export async function executeQueueSizeCommand (
  interaction: ChatInputCommandInteraction,
  getSize: GetQueueSizeFn
): Promise<void> {
  if (interaction.channel?.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'ボイスチャンネルのチャットでのみ使用できます', ephemeral: true });
    return;
  }

  const size = getSize(interaction.guildId!);
  await interaction.reply({ content: `待機中: ${size}件`, ephemeral: true });
}

export async function executeQueueClearCommand (
  interaction: ChatInputCommandInteraction,
  clearQueue: ClearQueueFn
): Promise<void> {
  if (interaction.channel?.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'ボイスチャンネルのチャットでのみ使用できます', ephemeral: true });
    return;
  }

  clearQueue(interaction.guildId!);
  await interaction.deferReply({ ephemeral: true });
  await interaction.deleteReply();
}
