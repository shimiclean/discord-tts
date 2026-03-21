import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export type SaveDictionaryEntryFn = (guildId: string, from: string, to: string) => void | Promise<void>;
export type RemoveDictionaryEntryFn = (guildId: string, from: string) => void | Promise<void>;

export function buildDictionaryCommand () {
  const builder = new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('読み上げ辞書の編集');

  builder.addStringOption((opt) =>
    opt.setName('from')
      .setDescription('置換対象テキスト')
      .setRequired(true)
  );

  builder.addStringOption((opt) =>
    opt.setName('to')
      .setDescription('置換後テキスト（空で削除）')
      .setRequired(false)
  );

  return builder;
}

export async function executeDictionaryCommand (
  interaction: ChatInputCommandInteraction,
  saveEntry: SaveDictionaryEntryFn,
  removeEntry: RemoveDictionaryEntryFn
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true });
    return;
  }

  const from = interaction.options.getString('from', true);
  const to = interaction.options.getString('to');

  if (to != null && to !== '') {
    await saveEntry(interaction.guildId!, from, to);
    await interaction.reply({
      content: `辞書に登録しました: 「${from}」→「${to}」`,
      ephemeral: true
    });
  } else {
    await removeEntry(interaction.guildId!, from);
    await interaction.reply({
      content: `辞書から削除しました: 「${from}」`,
      ephemeral: true
    });
  }
}
