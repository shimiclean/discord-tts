import { buildVoiceResetCommand, executeVoiceResetCommand } from './voiceResetCommand';

describe('voiceResetCommand', () => {
  describe('buildVoiceResetCommand', () => {
    it('コマンド名がvoice-resetである', () => {
      const command = buildVoiceResetCommand();
      expect(command.name).toBe('voice-reset');
    });

    it('説明文が設定されている', () => {
      const command = buildVoiceResetCommand();
      expect(command.description).toBeTruthy();
    });
  });

  describe('executeVoiceResetCommand', () => {
    const resetSpeaker = jest.fn();

    function createInteraction (guildId: string | null = 'guild1') {
      return {
        guildId,
        user: { id: 'user1' },
        reply: jest.fn()
      };
    }

    beforeEach(() => {
      resetSpeaker.mockClear();
    });

    it('設定をリセットしてリプライを返す', async () => {
      const interaction = createInteraction();
      await executeVoiceResetCommand(interaction as any, resetSpeaker);
      expect(resetSpeaker).toHaveBeenCalledWith('guild1', 'user1');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });

    it('ギルド外で実行された場合はエラーを返す', async () => {
      const interaction = createInteraction(null);
      await executeVoiceResetCommand(interaction as any, resetSpeaker);
      expect(resetSpeaker).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });
});
