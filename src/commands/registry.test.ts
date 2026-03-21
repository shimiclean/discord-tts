import { ChannelType } from 'discord.js';
import { createCommandRegistry } from './registry';

describe('createCommandRegistry', () => {
  const handlers = {
    getPlayer: jest.fn(),
    getQueueSize: jest.fn(),
    clearQueue: jest.fn(),
    saveDictionaryEntry: jest.fn(),
    removeDictionaryEntry: jest.fn(),
    saveVoiceSetting: jest.fn(),
    removeVoiceSetting: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('さくらのAI Engine無効時', () => {
    const registry = createCommandRegistry('https://other-tts.example.com', handlers);

    it('commandBodyにdictionary・skip・queue-size・queue-clearが含まれる', () => {
      const names = registry.commandBody.map((c: any) => c.name);
      expect(names).toContain('dictionary');
      expect(names).toContain('skip');
      expect(names).toContain('queue-size');
      expect(names).toContain('queue-clear');
    });

    it('commandBodyにvoice・voice-resetが含まれない', () => {
      const names = registry.commandBody.map((c: any) => c.name);
      expect(names).not.toContain('voice');
      expect(names).not.toContain('voice-reset');
    });
  });

  describe('さくらのAI Engine有効時', () => {
    const registry = createCommandRegistry('https://api.ai.sakura.ad.jp/v1', handlers);

    it('commandBodyにvoice・voice-resetが含まれる', () => {
      const names = registry.commandBody.map((c: any) => c.name);
      expect(names).toContain('voice');
      expect(names).toContain('voice-reset');
    });
  });

  describe('handleInteraction', () => {
    const registry = createCommandRegistry('https://other-tts.example.com', handlers);

    function createChatInputInteraction (commandName: string, guildId: string = 'guild1') {
      return {
        isAutocomplete: () => false,
        isChatInputCommand: () => true,
        commandName,
        guildId,
        channel: { type: ChannelType.GuildVoice },
        options: {
          getString: jest.fn()
        },
        reply: jest.fn(),
        deferReply: jest.fn().mockResolvedValue(undefined),
        deleteReply: jest.fn().mockResolvedValue(undefined)
      };
    }

    it('skipコマンドでgetPlayerが呼ばれる', async () => {
      const interaction = createChatInputInteraction('skip');
      await registry.handleInteraction(interaction as any);
      expect(handlers.getPlayer).toHaveBeenCalledWith('guild1');
    });

    it('queue-sizeコマンドでgetQueueSizeが呼ばれる', async () => {
      handlers.getQueueSize.mockReturnValue(3);
      const interaction = createChatInputInteraction('queue-size');
      await registry.handleInteraction(interaction as any);
      expect(handlers.getQueueSize).toHaveBeenCalledWith('guild1');
    });

    it('queue-clearコマンドでclearQueueが呼ばれる', async () => {
      handlers.clearQueue.mockReturnValue(0);
      const interaction = createChatInputInteraction('queue-clear');
      await registry.handleInteraction(interaction as any);
      expect(handlers.clearQueue).toHaveBeenCalledWith('guild1');
    });

    it('dictionaryコマンドの保存でsaveDictionaryEntryが呼ばれる', async () => {
      const interaction = createChatInputInteraction('dictionary');
      interaction.options.getString = jest.fn((name: string) => {
        if (name === 'from') { return 'hello'; }
        if (name === 'to') { return 'こんにちは'; }
        return null;
      });
      await registry.handleInteraction(interaction as any);
      expect(handlers.saveDictionaryEntry).toHaveBeenCalledWith('guild1', 'hello', 'こんにちは');
    });

    it('dictionaryコマンドの削除でremoveDictionaryEntryが呼ばれる', async () => {
      const interaction = createChatInputInteraction('dictionary');
      interaction.options.getString = jest.fn((name: string) => {
        if (name === 'from') { return 'hello'; }
        return null;
      });
      await registry.handleInteraction(interaction as any);
      expect(handlers.removeDictionaryEntry).toHaveBeenCalledWith('guild1', 'hello');
    });

    it('未知のコマンドは無視される', async () => {
      const interaction = createChatInputInteraction('unknown');
      await registry.handleInteraction(interaction as any);
      // エラーが発生しないこと
    });
  });
});
