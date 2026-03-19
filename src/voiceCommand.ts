import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { SakuraVoices } from './sakuraVoices';
import { TtsVoiceConfig } from './speakerConfig';

export type SaveSpeakerFn = (guildId: string, userId: string, voice: TtsVoiceConfig, guildName: string, userName: string) => void | Promise<void>;

export function buildVoiceCommand (voices: SakuraVoices) {
  const builder = new SlashCommandBuilder()
    .setName('voice')
    .setDescription('読み上げボイスのカスタマイズ');

  builder.addStringOption((opt) =>
    opt.setName('character')
      .setDescription('音声モデル')
      .setRequired(true)
      .addChoices(...voices.getCharacters().map((c) => ({ name: c.name, value: c.modelId })))
  );

  builder.addStringOption((opt) =>
    opt.setName('style')
      .setDescription('ボイススタイル')
      .setRequired(true)
      .setAutocomplete(true)
  );

  return builder;
}

export async function handleVoiceAutocomplete (interaction: AutocompleteInteraction, voices: SakuraVoices): Promise<void> {
  const character = interaction.options.getString('character');
  if (!character) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused();
  const styles = voices.getStyles(character)
    .filter((s) => s.name.includes(focused))
    .map((s) => ({ name: s.name, value: s.voiceId }));

  await interaction.respond(styles);
}

export async function executeVoiceCommand (
  interaction: ChatInputCommandInteraction,
  voices: SakuraVoices,
  saveSpeaker: SaveSpeakerFn
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true });
    return;
  }

  const character = interaction.options.getString('character', true);
  const style = interaction.options.getString('style', true);

  if (!voices.isValidCombination(character, style)) {
    const validStyles = voices.getStyles(character);
    const list = validStyles.map((s) => `${s.name} (${s.voiceId})`).join('・');
    await interaction.reply({
      content: `指定されたスタイルはこのキャラクターでは使用できません。利用可能なスタイル: ${list}`,
      ephemeral: true
    });
    return;
  }

  const voiceConfig: TtsVoiceConfig = { model: character, voice: style };
  await saveSpeaker(interaction.guildId, interaction.user.id, voiceConfig, interaction.guild!.name, interaction.user.displayName);

  const charInfo = voices.getCharacters().find((c) => c.modelId === character);
  const styleInfo = voices.getStyles(character).find((s) => s.voiceId === style);
  await interaction.reply({
    content: `読み上げボイスを ${charInfo?.name ?? character}（${styleInfo?.name ?? style}）に設定しました`,
    ephemeral: true
  });
}
