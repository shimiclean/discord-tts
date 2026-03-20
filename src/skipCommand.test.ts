import { ChannelType } from 'discord.js';
import { buildSkipCommand, executeSkipCommand } from './skipCommand';

describe('skipCommand', () => {
  describe('buildSkipCommand', () => {
    it('コマンド名がskipである', () => {
      const command = buildSkipCommand();
      expect(command.name).toBe('skip');
    });

    it('説明文が設定されている', () => {
      const command = buildSkipCommand();
      expect(command.description).toBeTruthy();
    });
  });

  describe('executeSkipCommand', () => {
    function createInteraction (channelType: ChannelType = ChannelType.GuildVoice, guildId: string | null = 'guild1') {
      return {
        guildId,
        channel: { type: channelType },
        reply: jest.fn(),
        deferReply: jest.fn().mockResolvedValue(undefined),
        deleteReply: jest.fn().mockResolvedValue(undefined)
      };
    }

    it('プレイヤーが存在する場合はstopを呼び応答を表示しない', async () => {
      const player = { stop: jest.fn() };
      const getPlayer = jest.fn().mockReturnValue(player);
      const interaction = createInteraction();

      await executeSkipCommand(interaction as any, getPlayer);

      expect(getPlayer).toHaveBeenCalledWith('guild1');
      expect(player.stop).toHaveBeenCalled();
      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(interaction.deleteReply).toHaveBeenCalled();
    });

    it('プレイヤーが存在しない場合は何もせず応答を表示しない', async () => {
      const getPlayer = jest.fn().mockReturnValue(undefined);
      const interaction = createInteraction();

      await executeSkipCommand(interaction as any, getPlayer);

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(interaction.deleteReply).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('ボイスチャンネル以外で実行された場合はエフェメラルでエラーを返す', async () => {
      const getPlayer = jest.fn();
      const interaction = createInteraction(ChannelType.GuildText);

      await executeSkipCommand(interaction as any, getPlayer);

      expect(getPlayer).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });
});
