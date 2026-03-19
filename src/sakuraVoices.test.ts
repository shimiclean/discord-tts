import { loadSakuraVoices, SakuraVoices } from './sakuraVoices';
import * as path from 'path';

const csvPath = path.join(__dirname, '..', 'data', 'sakura-voices.csv');

describe('loadSakuraVoices', () => {
  let voices: SakuraVoices;

  beforeAll(() => {
    voices = loadSakuraVoices(csvPath);
  });

  describe('characters', () => {
    it('全キャラクターを重複なく返す', () => {
      const chars = voices.getCharacters();
      const ids = chars.map((c) => c.modelId);
      expect(ids).toEqual([...new Set(ids)]);
      expect(ids).toContain('zundamon');
      expect(ids).toContain('shikokumetan');
    });

    it('各キャラクターにラベルとIDがある', () => {
      const chars = voices.getCharacters();
      const zundamon = chars.find((c) => c.modelId === 'zundamon');
      expect(zundamon).toEqual({ name: 'ずんだもん', modelId: 'zundamon' });
    });
  });

  describe('getStyles', () => {
    it('指定したキャラクターのスタイル一覧を返す', () => {
      const styles = voices.getStyles('zundamon');
      expect(styles.length).toBe(8);
      expect(styles).toContainEqual({ name: 'ノーマル', voiceId: 'normal' });
      expect(styles).toContainEqual({ name: 'あまあま', voiceId: 'amaama' });
    });

    it('スタイルが1つのキャラクターでも正しく返す', () => {
      const styles = voices.getStyles('kasukabetsumugi');
      expect(styles).toEqual([{ name: 'ノーマル', voiceId: 'normal' }]);
    });

    it('存在しないキャラクターには空配列を返す', () => {
      const styles = voices.getStyles('nonexistent');
      expect(styles).toEqual([]);
    });
  });

  describe('isValidCombination', () => {
    it('正しい組み合わせはtrueを返す', () => {
      expect(voices.isValidCombination('zundamon', 'normal')).toBe(true);
      expect(voices.isValidCombination('zundamon', 'amaama')).toBe(true);
      expect(voices.isValidCombination('shikokumetan', 'sexy')).toBe(true);
    });

    it('キャラクターに存在しないスタイルはfalseを返す', () => {
      expect(voices.isValidCombination('kasukabetsumugi', 'amaama')).toBe(false);
    });

    it('存在しないキャラクターはfalseを返す', () => {
      expect(voices.isValidCombination('nonexistent', 'normal')).toBe(false);
    });
  });
});
