import { loadDictionary, createReloadableDictionary, saveDictionaryEntry, removeDictionaryEntry, createReloadableGuildDictionary, saveGuildDictionaryEntry, removeGuildDictionaryEntry } from './dictionary';
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

    it('ASCIIキーは単語境界でマッチする', () => {
      const dict = loadDictionary(createTempFile('"w": "草"'));
      expect(dict.apply('www')).toBe('www');
    });

    it('ASCIIキーが単語として出現する場合は置換する', () => {
      const dict = loadDictionary(createTempFile('"w": "草"'));
      expect(dict.apply('それは w だね')).toBe('それは 草 だね');
    });

    it('ASCIIキーが日本語に隣接する場合は単語境界として扱う', () => {
      const dict = loadDictionary(createTempFile('"w": "草"'));
      expect(dict.apply('それはwだね')).toBe('それは草だね');
    });

    it('ASCIIキーが複数箇所で単語境界にマッチする場合はすべて置換する', () => {
      const dict = loadDictionary(createTempFile('"lol": "笑"'));
      expect(dict.apply('lolとlol')).toBe('笑と笑');
    });

    it('非ASCIIキーは部分文字列でもマッチする', () => {
      const dict = loadDictionary(createTempFile('"不要": ""'));
      expect(dict.apply('これは不要な文字')).toBe('これはな文字');
    });

    it('複数のルールを定義順に適用する', () => {
      const filePath = createTempFile([
        '"Discord": "ディスコード"',
        '"TS": "タイプスクリプト"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('DiscordのTSボット')).toBe('ディスコードのタイプスクリプトボット');
    });

    it('置換結果は再度マッチされない（同時処理）', () => {
      const filePath = createTempFile([
        '"A": "BC"',
        '"BC": "D"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      // A→BC の置換結果 "BC" が BC→D で再置換されない
      expect(dict.apply('A')).toBe('BC');
    });

    it('元のテキストに含まれる BC は置換される', () => {
      const filePath = createTempFile([
        '"A": "BC"',
        '"BC": "D"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      // ASCIIキーは単語境界で区切られるため「ABC」ではマッチしない
      expect(dict.apply('A BC')).toBe('BC D');
    });

    it('最長一致で置換する（短いキーより長いキーが優先）', () => {
      const filePath = createTempFile([
        '"あ": "短"',
        '"ああ": "長"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('ああ')).toBe('長');
    });

    it('最長一致: 長いキーが定義順で後にあっても優先される', () => {
      const filePath = createTempFile([
        '"あ": "短"',
        '"ああ": "長"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('あああ')).toBe('長短');
    });

    it('最長一致: ASCIIキーでも長い方が優先される', () => {
      const filePath = createTempFile([
        '"w": "草"',
        '"ww": "大草原"'
      ].join('\n'));
      const dict = loadDictionary(filePath);
      expect(dict.apply('wwだよ')).toBe('大草原だよ');
    });

    it('マッチしないルールはスキップされる', () => {
      const dict = loadDictionary(createTempFile('"xyz": "abc"'));
      expect(dict.apply('こんにちは')).toBe('こんにちは');
    });

    it('空文字列への置換（削除）ができる', () => {
      const dict = loadDictionary(createTempFile('"不要": ""'));
      expect(dict.apply('これは不要な文字')).toBe('これはな文字');
    });

    it('先頭がASCIIのキーはASCII側に単語境界を適用する', () => {
      const dict = loadDictionary(createTempFile('"aあ": "置換"'));
      expect(dict.apply('aaあ')).toBe('aaあ');
      expect(dict.apply('xaあ')).toBe('xaあ');
    });

    it('先頭がASCIIのキーが単語境界で出現する場合は置換する', () => {
      const dict = loadDictionary(createTempFile('"aあ": "置換"'));
      expect(dict.apply('これはaあです')).toBe('これは置換です');
      expect(dict.apply('x aあ')).toBe('x 置換');
    });

    it('末尾がASCIIのキーはASCII側に単語境界を適用する', () => {
      const dict = loadDictionary(createTempFile('"あa": "置換"'));
      expect(dict.apply('あab')).toBe('あab');
      expect(dict.apply('あax')).toBe('あax');
    });

    it('末尾がASCIIのキーが単語境界で出現する場合は置換する', () => {
      const dict = loadDictionary(createTempFile('"あa": "置換"'));
      expect(dict.apply('これはあaです')).toBe('これは置換です');
      expect(dict.apply('あa end')).toBe('置換 end');
    });

    it('両端が非ASCIIのキーは単語境界を適用しない', () => {
      const dict = loadDictionary(createTempFile('"あa太郎": "置換"'));
      expect(dict.apply('これはあa太郎です')).toBe('これは置換です');
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
    expect(dict.apply('それはw')).toBe('それは草');
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

describe('createReloadableGuildDictionary', () => {
  function createGuildFile (content: string): string {
    const dir = createTempDir();
    const filePath = path.join(dir, 'dictionary-guild.yml');
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  describe('forGuild', () => {
    it('グローバル辞書のルールを適用する', () => {
      const globalPath = createTempFile('"w": "草"');
      const guildPath = createGuildFile('');
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('それはw')).toBe('それは草');
    });

    it('ギルド辞書のルールを適用する', () => {
      const globalPath = createTempFile('');
      const guildPath = createGuildFile([
        '"guild1":',
        '  "w": "ワロタ"'
      ].join('\n'));
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('それはw')).toBe('それはワロタ');
    });

    it('同じキーはギルド辞書が優先される', () => {
      const globalPath = createTempFile('"w": "草"');
      const guildPath = createGuildFile([
        '"guild1":',
        '  "w": "ワロタ"'
      ].join('\n'));
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('それはw')).toBe('それはワロタ');
    });

    it('ギルド辞書にないキーはグローバル辞書にフォールバックする', () => {
      const globalPath = createTempFile([
        '"w": "草"',
        '"lol": "笑"'
      ].join('\n'));
      const guildPath = createGuildFile([
        '"guild1":',
        '  "w": "ワロタ"'
      ].join('\n'));
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('wとlol')).toBe('ワロタと笑');
    });

    it('未登録のギルドではグローバル辞書のみ適用する', () => {
      const globalPath = createTempFile('"w": "草"');
      const guildPath = createGuildFile([
        '"guild1":',
        '  "w": "ワロタ"'
      ].join('\n'));
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild2').apply('それはw')).toBe('それは草');
    });

    it('グローバル・ギルド両方空の場合はそのまま返す', () => {
      const globalPath = createTempFile('');
      const guildPath = createGuildFile('');
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('テスト')).toBe('テスト');
    });
  });

  describe('reload', () => {
    it('グローバル辞書の変更を反映する', () => {
      const globalPath = createTempFile('"w": "草"');
      const guildPath = createGuildFile('');
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('w')).toBe('草');

      fs.writeFileSync(globalPath, '"w": "芝"', 'utf-8');
      dict.reloadGlobal();
      expect(dict.forGuild('guild1').apply('w')).toBe('芝');
    });

    it('ギルド辞書の変更を反映する', () => {
      const globalPath = createTempFile('"w": "草"');
      const guildPath = createGuildFile('');
      const dict = createReloadableGuildDictionary(globalPath, guildPath);
      expect(dict.forGuild('guild1').apply('w')).toBe('草');

      fs.writeFileSync(guildPath, [
        '"guild1":',
        '  "w": "ワロタ"'
      ].join('\n'), 'utf-8');
      dict.reloadGuild();
      expect(dict.forGuild('guild1').apply('w')).toBe('ワロタ');
    });
  });
});

describe('saveGuildDictionaryEntry', () => {
  it('ギルド辞書にエントリを保存する', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    await saveGuildDictionaryEntry(guildPath, 'guild1', 'w', '草');
    const content = fs.readFileSync(guildPath, 'utf-8');
    expect(content).toContain('guild1');
    expect(content).toContain('w');
  });

  it('既存のギルドにエントリを追加する', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    fs.writeFileSync(guildPath, [
      '"guild1":',
      '  "w": "草"'
    ].join('\n'), 'utf-8');
    await saveGuildDictionaryEntry(guildPath, 'guild1', 'lol', '笑');
    const globalPath = createTempFile('');
    const dict = createReloadableGuildDictionary(globalPath, guildPath);
    expect(dict.forGuild('guild1').apply('wとlol')).toBe('草と笑');
  });

  it('別のギルドのエントリに影響しない', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    fs.writeFileSync(guildPath, [
      '"guild1":',
      '  "w": "草"'
    ].join('\n'), 'utf-8');
    await saveGuildDictionaryEntry(guildPath, 'guild2', 'w', 'ワロタ');
    const globalPath = createTempFile('');
    const dict = createReloadableGuildDictionary(globalPath, guildPath);
    expect(dict.forGuild('guild1').apply('w')).toBe('草');
    expect(dict.forGuild('guild2').apply('w')).toBe('ワロタ');
  });
});

describe('removeGuildDictionaryEntry', () => {
  it('ギルド辞書からエントリを削除する', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    fs.writeFileSync(guildPath, [
      '"guild1":',
      '  "w": "草"',
      '  "lol": "笑"'
    ].join('\n'), 'utf-8');
    await removeGuildDictionaryEntry(guildPath, 'guild1', 'w');
    const globalPath = createTempFile('');
    const dict = createReloadableGuildDictionary(globalPath, guildPath);
    expect(dict.forGuild('guild1').apply('w')).toBe('w');
    expect(dict.forGuild('guild1').apply('lol')).toBe('笑');
  });

  it('存在しないギルドの削除はエラーにならない', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    await expect(removeGuildDictionaryEntry(guildPath, 'guild1', 'w')).resolves.not.toThrow();
  });

  it('存在しないキーの削除はエラーにならない', async () => {
    const dir = createTempDir();
    const guildPath = path.join(dir, 'dictionary-guild.yml');
    fs.writeFileSync(guildPath, [
      '"guild1":',
      '  "w": "草"'
    ].join('\n'), 'utf-8');
    await removeGuildDictionaryEntry(guildPath, 'guild1', 'nonexistent');
    const globalPath = createTempFile('');
    const dict = createReloadableGuildDictionary(globalPath, guildPath);
    expect(dict.forGuild('guild1').apply('w')).toBe('草');
  });
});
