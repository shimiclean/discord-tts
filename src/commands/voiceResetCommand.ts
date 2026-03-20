import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export type ResetSpeakerFn = (guildId: string, userId: string) => void | Promise<void>;

export function buildVoiceResetCommand () {
  return new SlashCommandBuilder()
    .setName('voice-reset')
    .setDescription('読み上げボイスのカスタマイズをリセット');
}

export async function executeVoiceResetCommand (
  interaction: ChatInputCommandInteraction,
  resetSpeaker: ResetSpeakerFn
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true });
    return;
  }

  await resetSpeaker(interaction.guildId, interaction.user.id);

  await interaction.reply({
    content: '読み上げボイスの設定をリセットしました',
    ephemeral: true
  });
}
