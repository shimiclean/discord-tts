import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { AudioPlayer } from '@discordjs/voice';

export type GetPlayerFn = (guildId: string) => AudioPlayer | undefined;

export function buildSkipCommand () {
  return new SlashCommandBuilder()
    .setName('skip')
    .setDescription('現在の読み上げをスキップ');
}

export async function executeSkipCommand (
  interaction: ChatInputCommandInteraction,
  getPlayer: GetPlayerFn
): Promise<void> {
  if (interaction.channel?.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: 'ボイスチャンネルのチャットでのみ使用できます', ephemeral: true });
    return;
  }

  const player = interaction.guildId ? getPlayer(interaction.guildId) : undefined;
  if (player) {
    player.stop();
  }

  await interaction.deferReply({ ephemeral: true });
  await interaction.deleteReply();
}
