import { loadDictionary, createReloadableDictionary, saveDictionaryEntry, removeDictionaryEntry } from './dictionary';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempDir (): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dict-'));
}

function createTempFile (content: string): string {
  const dir = createTempDir();
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

describe('createReloadableDictionary', () => {
  describe('初期読み込み', () => {
    it('ファイルが存在しない場合はテキストをそのまま返す', () => {
      const dir = createTempDir();
      const dict = createReloadableDictionary(path.join(dir, 'dictionary.yml'));
      expect(dict.apply('こんにちは')).toBe('こんにちは');
    });

    it('既存のファイルからルールを読み込む', () => {
      const filePath = createTempFile('"w": "草"');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('それはw')).toBe('それは草');
    });
  });

  describe('reload', () => {
    it('ファイルが更新された後にreloadすると新しいルールを反映する', () => {
      const filePath = createTempFile('"w": "草"');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('wとlol')).toBe('草とlol');

      fs.writeFileSync(filePath, '"lol": "笑"', 'utf-8');
      dict.reload();

      expect(dict.apply('wとlol')).toBe('wと笑');
    });

    it('ファイルが削除された後にreloadすると置換なしになる', () => {
      const filePath = createTempFile('"w": "草"');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('w')).toBe('草');

      fs.unlinkSync(filePath);
      dict.reload();

      expect(dict.apply('w')).toBe('w');
    });

    it('ファイルが新規作成された後にreloadするとルールを読み込む', () => {
      const dir = createTempDir();
      const filePath = path.join(dir, 'dictionary.yml');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('w')).toBe('w');

      fs.writeFileSync(filePath, '"w": "草"', 'utf-8');
      dict.reload();

      expect(dict.apply('w')).toBe('草');
    });
  });

  describe('エラー耐性', () => {
    it('不正なYAMLでreloadしても前のルールを維持する', () => {
      const filePath = createTempFile('"w": "草"');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('w')).toBe('草');

      fs.writeFileSync(filePath, '{{invalid', 'utf-8');
      dict.reload();

      expect(dict.apply('w')).toBe('草');
    });

    it('値が文字列でないYAMLでreloadしても前のルールを維持する', () => {
      const filePath = createTempFile('"w": "草"');
      const dict = createReloadableDictionary(filePath);
      expect(dict.apply('w')).toBe('草');

      fs.writeFileSync(filePath, '"key": 123', 'utf-8');
      dict.reload();

      expect(dict.apply('w')).toBe('草');
    });
  });
});

describe('saveDictionaryEntry', () => {
  it('ファイルが存在しない場合は新規作成してエントリを保存する', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'dictionary.yml');
    await saveDictionaryEntry(filePath, 'w', '草');
    const dict = loadDictionary(filePath);
    expect(dict.apply('www')).toBe('草草草');
  });

  it('既存ファイルにエントリを追加する', async () => {
    const filePath = createTempFile('"w": "草"');
    await saveDictionaryEntry(filePath, 'lol', '笑');
    const dict = loadDictionary(filePath);
    expect(dict.apply('wとlol')).toBe('草と笑');
  });

  it('既存のキーを上書きする', async () => {
    const filePath = createTempFile('"w": "草"');
    await saveDictionaryEntry(filePath, 'w', 'ワロタ');
    const dict = loadDictionary(filePath);
    expect(dict.apply('w')).toBe('ワロタ');
  });

  it('既存エントリの順序を維持したまま上書きする', async () => {
    const filePath = createTempFile([
      '"A": "1"',
      '"B": "2"',
      '"C": "3"'
    ].join('\n'));
    await saveDictionaryEntry(filePath, 'B', '更新');
    const content = fs.readFileSync(filePath, 'utf-8');
    const keys = [...content.matchAll(/^(\S+):/gm)].map(m => m[1]);
    expect(keys).toEqual(['A', 'B', 'C']);
  });
});

describe('removeDictionaryEntry', () => {
  it('指定したキーのエントリを削除する', async () => {
    const filePath = createTempFile([
      '"w": "草"',
      '"lol": "笑"'
    ].join('\n'));
    await removeDictionaryEntry(filePath, 'w');
    const dict = loadDictionary(filePath);
    expect(dict.apply('wとlol')).toBe('wと笑');
  });

  it('存在しないキーを削除してもエラーにならない', async () => {
    const filePath = createTempFile('"w": "草"');
    await removeDictionaryEntry(filePath, 'nonexistent');
    const dict = loadDictionary(filePath);
    expect(dict.apply('w')).toBe('草');
  });

  it('ファイルが存在しない場合はエラーにならない', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'dictionary.yml');
    await expect(removeDictionaryEntry(filePath, 'w')).resolves.not.toThrow();
  });

  it('最後のエントリを削除した場合は空のファイルになる', async () => {
    const filePath = createTempFile('"w": "草"');
    await removeDictionaryEntry(filePath, 'w');
    const dict = loadDictionary(filePath);
    expect(dict.apply('w')).toBe('w');
  });
});
