import { ChannelType } from 'discord.js';
import {
  buildQueueSizeCommand,
  buildQueueClearCommand,
  executeQueueSizeCommand,
  executeQueueClearCommand
} from './queueCommand';

describe('queueCommand', () => {
  describe('buildQueueSizeCommand', () => {
    it('コマンド名がqueue-sizeである', () => {
      const command = buildQueueSizeCommand();
      expect(command.name).toBe('queue-size');
    });

    it('説明文が設定されている', () => {
      const command = buildQueueSizeCommand();
      expect(command.description).toBeTruthy();
    });
  });

  describe('buildQueueClearCommand', () => {
    it('コマンド名がqueue-clearである', () => {
      const command = buildQueueClearCommand();
      expect(command.name).toBe('queue-clear');
    });

    it('説明文が設定されている', () => {
      const command = buildQueueClearCommand();
      expect(command.description).toBeTruthy();
    });
  });

  describe('executeQueueSizeCommand', () => {
    function createInteraction (channelType: ChannelType = ChannelType.GuildVoice, guildId: string | null = 'guild1') {
      return {
        guildId,
        channel: { type: channelType },
        reply: jest.fn()
      };
    }

    it('キューのサイズをエフェメラルで返す', async () => {
      const getSize = jest.fn().mockReturnValue(5);
      const interaction = createInteraction();

      await executeQueueSizeCommand(interaction as any, getSize);

      expect(getSize).toHaveBeenCalledWith('guild1');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
      expect(interaction.reply.mock.calls[0][0].content).toContain('5');
    });

    it('キューが空の場合は0を表示する', async () => {
      const getSize = jest.fn().mockReturnValue(0);
      const interaction = createInteraction();

      await executeQueueSizeCommand(interaction as any, getSize);

      expect(interaction.reply.mock.calls[0][0].content).toContain('0');
    });

    it('ボイスチャンネル以外で実行された場合はエフェメラルでエラーを返す', async () => {
      const getSize = jest.fn();
      const interaction = createInteraction(ChannelType.GuildText);

      await executeQueueSizeCommand(interaction as any, getSize);

      expect(getSize).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });

  describe('executeQueueClearCommand', () => {
    function createInteraction (channelType: ChannelType = ChannelType.GuildVoice, guildId: string | null = 'guild1') {
      return {
        guildId,
        channel: { type: channelType },
        reply: jest.fn(),
        deferReply: jest.fn().mockResolvedValue(undefined),
        deleteReply: jest.fn().mockResolvedValue(undefined)
      };
    }

    it('キューをクリアし応答を表示しない', async () => {
      const clearQueue = jest.fn().mockReturnValue(3);
      const interaction = createInteraction();

      await executeQueueClearCommand(interaction as any, clearQueue);

      expect(clearQueue).toHaveBeenCalledWith('guild1');
      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(interaction.deleteReply).toHaveBeenCalled();
    });

    it('ボイスチャンネル以外で実行された場合はエフェメラルでエラーを返す', async () => {
      const clearQueue = jest.fn();
      const interaction = createInteraction(ChannelType.GuildText);

      await executeQueueClearCommand(interaction as any, clearQueue);

      expect(clearQueue).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });
});
