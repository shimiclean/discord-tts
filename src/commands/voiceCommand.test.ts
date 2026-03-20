import { buildVoiceCommand, executeVoiceCommand, handleVoiceAutocomplete } from './voiceCommand';
import { loadSakuraVoices } from '../sakuraVoices';
import * as path from 'path';

const voices = loadSakuraVoices(path.join(__dirname, '..', '..', 'data', 'sakura-voices.csv'));

describe('voiceCommand', () => {
  describe('buildVoiceCommand', () => {
    it('コマンド名がvoiceである', () => {
      const command = buildVoiceCommand(voices);
      expect(command.name).toBe('voice');
    });

    it('説明文が設定されている', () => {
      const command = buildVoiceCommand(voices);
      expect(command.description).toBeTruthy();
    });

    it('characterオプションが必須で定義されている', () => {
      const command = buildVoiceCommand(voices);
      const json = command.toJSON();
      const opt = (json.options as any[])?.find((o: any) => o.name === 'character');
      expect(opt).toBeDefined();
      expect(opt.required).toBe(true);
    });

    it('characterオプションに全キャラクターが選択肢として含まれる', () => {
      const command = buildVoiceCommand(voices);
      const json = command.toJSON();
      const opt = (json.options as any[])?.find((o: any) => o.name === 'character');
      expect(opt.choices).toContainEqual({ name: 'ずんだもん', value: 'zundamon' });
      expect(opt.choices).toContainEqual({ name: '四国めたん', value: 'shikokumetan' });
      expect(opt.choices.length).toBe(voices.getCharacters().length);
    });

    it('styleオプションが必須でオートコンプリートが有効である', () => {
      const command = buildVoiceCommand(voices);
      const json = command.toJSON();
      const opt = (json.options as any[])?.find((o: any) => o.name === 'style');
      expect(opt).toBeDefined();
      expect(opt.required).toBe(true);
      expect(opt.autocomplete).toBe(true);
    });
  });

  describe('handleVoiceAutocomplete', () => {
    it('選択されたキャラクターのスタイルのみを返す', async () => {
      const respond = jest.fn();
      const interaction = {
        options: {
          getString: jest.fn((name: string) => {
            if (name === 'character') { return 'kasukabetsumugi'; }
            return '';
          }),
          getFocused: jest.fn(() => '')
        },
        respond
      };
      await handleVoiceAutocomplete(interaction as any, voices);
      expect(respond).toHaveBeenCalledWith([
        { name: 'ノーマル', value: 'normal' }
      ]);
    });

    it('入力テキストでスタイルをフィルタリングする', async () => {
      const respond = jest.fn();
      const interaction = {
        options: {
          getString: jest.fn((name: string) => {
            if (name === 'character') { return 'zundamon'; }
            return '';
          }),
          getFocused: jest.fn(() => 'あま')
        },
        respond
      };
      await handleVoiceAutocomplete(interaction as any, voices);
      expect(respond).toHaveBeenCalledWith([
        { name: 'あまあま', value: 'amaama' }
      ]);
    });

    it('キャラクター未選択時は空配列を返す', async () => {
      const respond = jest.fn();
      const interaction = {
        options: {
          getString: jest.fn(() => null),
          getFocused: jest.fn(() => '')
        },
        respond
      };
      await handleVoiceAutocomplete(interaction as any, voices);
      expect(respond).toHaveBeenCalledWith([]);
    });
  });

  describe('executeVoiceCommand', () => {
    const saveSpeaker = jest.fn();

    function createInteraction (character: string, style: string, guildId: string | null = 'guild1') {
      return {
        guildId,
        guild: guildId ? { name: 'テストサーバー' } : null,
        user: { id: 'user1', displayName: 'テストユーザー' },
        options: {
          getString: jest.fn((name: string) => {
            if (name === 'character') { return character; }
            if (name === 'style') { return style; }
            return null;
          })
        },
        reply: jest.fn()
      };
    }

    beforeEach(() => {
      saveSpeaker.mockClear();
    });

    it('正しい組み合わせで設定を保存してリプライを返す', async () => {
      const interaction = createInteraction('zundamon', 'normal');
      await executeVoiceCommand(interaction as any, voices, saveSpeaker);
      expect(saveSpeaker).toHaveBeenCalledWith('guild1', 'user1', { model: 'zundamon', voice: 'normal' }, 'テストサーバー', 'テストユーザー');
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });

    it('不正な組み合わせでは設定を保存せずエラーとスタイル一覧を返す', async () => {
      const interaction = createInteraction('kasukabetsumugi', 'amaama');
      await executeVoiceCommand(interaction as any, voices, saveSpeaker);
      expect(saveSpeaker).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
          content: expect.stringContaining('ノーマル')
        })
      );
    });

    it('ギルド外で実行された場合はエラーを返す', async () => {
      const interaction = createInteraction('zundamon', 'normal', null);
      await executeVoiceCommand(interaction as any, voices, saveSpeaker);
      expect(saveSpeaker).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });
});
