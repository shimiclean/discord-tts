import { loadDictionary } from './dictionary';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempFile (content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dict-'));
  const filePath = path.join(dir, 'dictionary.yml');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('loadDictionary', () => {
  describe('ファイルが存在しない場合', () => {
    it('テキストをそのまま返す', () => {
      const dict = loadDictionary('/nonexistent/dictionary.yml');
      expect(dict.apply('こんにちは')).toBe('こんにちは');
    });
  });

  describe('ファイルが空の場合', () => {
    it('テキストをそのまま返す', () => {
      const dict = loadDictionary(createTempFile(''));
      expect(dict.apply('こんにちは')).toBe('こんにちは');
    });
  });

  describe('置換ルール', () => {
    it('単一のルールで置換する', () => {
      const dict = loadDictionary(createTempFile('"w": "草"'));
      expect(dict.apply('それはw')).toBe('それは草');
    });

    it('テキスト内の全ての出現箇所を置換する', () => {
      const dict = loadDictionary(createTempFile('"w": "草"'));
      expect(dict.apply('www')).toBe('草草草');
    });

    it('複数のルールを定義順に適用する', () => {
      const filePath = createTempFile([
        '"Discord": "ディスコード"',
        '"TS": "タイプスクリプト"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('DiscordのTSボット')).toBe('ディスコードのタイプスクリプトボット');
    });

    it('先の置換結果に後のルールがマッチする場合も置換される', () => {
      const filePath = createTempFile([
        '"A": "BC"',
        '"BC": "D"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('A')).toBe('D');
    });

    it('マッチしないルールはスキップされる', () => {
      const dict = loadDictionary(createTempFile('"xyz": "abc"'));
      expect(dict.apply('こんにちは')).toBe('こんにちは');
    });

    it('空文字列への置換（削除）ができる', () => {
      const dict = loadDictionary(createTempFile('"不要": ""'));
      expect(dict.apply('これは不要な文字')).toBe('これはな文字');
    });
  });

  describe('バリデーション', () => {
    it('不正なYAMLの場合はエラーを投げる', () => {
      expect(() => loadDictionary(createTempFile('{{invalid'))).toThrow();
    });

    it('値が文字列でない場合はエラーを投げる', () => {
      expect(() => loadDictionary(createTempFile('"key": 123'))).toThrow();
    });

    it('値が配列の場合はエラーを投げる', () => {
      const filePath = createTempFile([
        '"key":',
        '  - "a"',
        '  - "b"'
      ].join('\n'));
      expect(() => loadDictionary(filePath)).toThrow();
    });
  });
});
