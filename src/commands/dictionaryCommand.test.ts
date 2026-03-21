import { buildDictionaryCommand, executeDictionaryCommand } from './dictionaryCommand';

describe('dictionaryCommand', () => {
  describe('buildDictionaryCommand', () => {
    it('コマンド名がdictionaryである', () => {
      const command = buildDictionaryCommand();
      expect(command.name).toBe('dictionary');
    });

    it('説明文が設定されている', () => {
      const command = buildDictionaryCommand();
      expect(command.description).toBeTruthy();
    });

    it('fromオプションが必須で定義されている', () => {
      const command = buildDictionaryCommand();
      const json = command.toJSON();
      const opt = (json.options as any[])?.find((o: any) => o.name === 'from');
      expect(opt).toBeDefined();
      expect(opt.required).toBe(true);
    });

    it('toオプションが任意で定義されている', () => {
      const command = buildDictionaryCommand();
      const json = command.toJSON();
      const opt = (json.options as any[])?.find((o: any) => o.name === 'to');
      expect(opt).toBeDefined();
      expect(opt.required).toBeFalsy();
    });
  });

  describe('executeDictionaryCommand', () => {
    const saveEntry = jest.fn();
    const removeEntry = jest.fn();

    function createInteraction (from: string, to: string | null, guildId: string | null = 'guild1') {
      return {
        guildId,
        options: {
          getString: jest.fn((name: string) => {
            if (name === 'from') { return from; }
            if (name === 'to') { return to; }
            return null;
          })
        },
        reply: jest.fn()
      };
    }

    beforeEach(() => {
      saveEntry.mockClear();
      removeEntry.mockClear();
    });

    it('toが指定されている場合はギルドIDとともにエントリを保存してリプライを返す', async () => {
      const interaction = createInteraction('w', '草');
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      expect(saveEntry).toHaveBeenCalledWith('guild1', 'w', '草');
      expect(removeEntry).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });

    it('toが空文字列の場合はギルドIDとともにエントリを削除してリプライを返す', async () => {
      const interaction = createInteraction('w', '');
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      expect(removeEntry).toHaveBeenCalledWith('guild1', 'w');
      expect(saveEntry).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });

    it('toが未指定(null)の場合はギルドIDとともにエントリを削除してリプライを返す', async () => {
      const interaction = createInteraction('w', null);
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      expect(removeEntry).toHaveBeenCalledWith('guild1', 'w');
      expect(saveEntry).not.toHaveBeenCalled();
    });

    it('ギルド外で実行された場合はエラーを返す', async () => {
      const interaction = createInteraction('w', '草', null);
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      expect(saveEntry).not.toHaveBeenCalled();
      expect(removeEntry).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });

    it('保存時のリプライに置換ルールの内容が含まれる', async () => {
      const interaction = createInteraction('Discord', 'ディスコード');
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      const content = interaction.reply.mock.calls[0][0].content;
      expect(content).toContain('Discord');
      expect(content).toContain('ディスコード');
    });

    it('削除時のリプライに削除対象のキーが含まれる', async () => {
      const interaction = createInteraction('w', null);
      await executeDictionaryCommand(interaction as any, saveEntry, removeEntry);
      const content = interaction.reply.mock.calls[0][0].content;
      expect(content).toContain('w');
    });
  });
});
