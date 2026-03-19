import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadSpeakerConfig, createReloadableSpeakerConfig, saveUserVoiceSetting, removeUserVoiceSetting } from './speakerConfig';

function tmpFile (content?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
  const filePath = path.join(dir, 'speakers.yml');
  if (content !== undefined) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  return filePath;
}

describe('loadSpeakerConfig', () => {
  describe('ファイルが存在しない場合', () => {
    it('resolve は空オブジェクトを返す', () => {
      const config = loadSpeakerConfig('/nonexistent/speakers.yml');
      expect(config.resolve('guild1', 'user1')).toEqual({});
    });
  });

  describe('ファイルが空の場合', () => {
    it('resolve は空オブジェクトを返す', () => {
      const filePath = tmpFile('');
      const config = loadSpeakerConfig(filePath);
      expect(config.resolve('guild1', 'user1')).toEqual({});
    });
  });

  describe('ギルドレベルの設定', () => {
    it('ギルドの model と voice を返す', () => {
      const filePath = tmpFile('"guild1":\n  model: zundamon\n  voice: zundamon\n');
      const config = loadSpeakerConfig(filePath);
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });
    });

    it('ギルドが未設定の場合は空オブジェクトを返す', () => {
      const filePath = tmpFile('"guild1":\n  model: zundamon\n  voice: zundamon\n');
      const config = loadSpeakerConfig(filePath);
      expect(config.resolve('guild2', 'user1')).toEqual({});
    });

    it('model のみ設定した場合は voice を含めない', () => {
      const filePath = tmpFile('"guild1":\n  model: zundamon\n');
      const config = loadSpeakerConfig(filePath);
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon' });
    });

    it('voice のみ設定した場合は model を含めない', () => {
      const filePath = tmpFile('"guild1":\n  voice: shimmer\n');
      const config = loadSpeakerConfig(filePath);
      expect(config.resolve('guild1', 'user1')).toEqual({ voice: 'shimmer' });
    });
  });

  describe('ユーザーレベルの設定', () => {
    it('ユーザー設定がギルド設定を上書きする', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon',
        '  users:',
        '    "user1":',
        '      model: alloy',
        '      voice: nova'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'nova' });
    });

    it('ユーザーで model のみ設定した場合はギルドの voice を継承する', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon',
        '  users:',
        '    "user1":',
        '      model: alloy'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'zundamon' });
    });

    it('ユーザーで voice のみ設定した場合はギルドの model を継承する', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon',
        '  users:',
        '    "user1":',
        '      voice: nova'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'nova' });
    });

    it('ユーザーが users に未登録の場合はギルド設定を返す', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon',
        '  users:',
        '    "user1":',
        '      model: alloy'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user2')).toEqual({ model: 'zundamon', voice: 'zundamon' });
    });
  });

  describe('system ユーザー', () => {
    it('system キーで入退出メッセージの話者スタイルを解決する', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon',
        '  users:',
        '    system:',
        '      model: alloy',
        '      voice: shimmer'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'system')).toEqual({ model: 'alloy', voice: 'shimmer' });
    });

    it('system が未設定の場合はギルド設定にフォールバックする', () => {
      const yaml = [
        '"guild1":',
        '  model: zundamon',
        '  voice: zundamon'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'system')).toEqual({ model: 'zundamon', voice: 'zundamon' });
    });
  });

  describe('ギルドレベルも未設定のフィールド', () => {
    it('ユーザー・ギルドともに未設定のフィールドは結果に含まれない', () => {
      const yaml = [
        '"guild1":',
        '  users:',
        '    "user1":',
        '      model: alloy'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      // model はユーザーから、voice はギルドにもないので含まれない
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy' });
    });
  });

  describe('guild-name と user-name を無視する', () => {
    it('guild-name がギルド設定に含まれていても無視する', () => {
      const yaml = [
        '"guild1":',
        '  guild-name: テストサーバー',
        '  model: zundamon',
        '  voice: zundamon'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });
    });

    it('user-name がユーザー設定に含まれていても無視する', () => {
      const yaml = [
        '"guild1":',
        '  users:',
        '    "user1":',
        '      user-name: テストユーザー',
        '      model: alloy',
        '      voice: nova'
      ].join('\n');
      const config = loadSpeakerConfig(tmpFile(yaml));
      expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'nova' });
    });
  });

  describe('バリデーション', () => {
    it('ルートが配列の場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('- item1\n- item2\n'))).toThrow();
    });

    it('ギルドの値がオブジェクトでない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1": 123\n'))).toThrow();
    });

    it('model が文字列でない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1":\n  model: 123\n'))).toThrow();
    });

    it('voice が文字列でない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1":\n  voice: true\n'))).toThrow();
    });

    it('users がオブジェクトでない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1":\n  users: 123\n'))).toThrow();
    });

    it('ユーザーの値がオブジェクトでない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1":\n  users:\n    "user1": 123\n'))).toThrow();
    });

    it('ユーザーの model が文字列でない場合は例外を投げる', () => {
      const yaml = '"guild1":\n  users:\n    "user1":\n      model: 123\n';
      expect(() => loadSpeakerConfig(tmpFile(yaml))).toThrow();
    });

    it('ユーザーの voice が文字列でない場合は例外を投げる', () => {
      const yaml = '"guild1":\n  users:\n    "user1":\n      voice: true\n';
      expect(() => loadSpeakerConfig(tmpFile(yaml))).toThrow();
    });

    it('guild-name が文字列でない場合は例外を投げる', () => {
      expect(() => loadSpeakerConfig(tmpFile('"guild1":\n  guild-name: 123\n'))).toThrow();
    });

    it('user-name が文字列でない場合は例外を投げる', () => {
      const yaml = '"guild1":\n  users:\n    "user1":\n      user-name: 123\n';
      expect(() => loadSpeakerConfig(tmpFile(yaml))).toThrow();
    });
  });
});

describe('createReloadableSpeakerConfig', () => {
  it('初期ロードが正しく行われる', () => {
    const filePath = tmpFile('"guild1":\n  model: zundamon\n  voice: zundamon\n');
    const config = createReloadableSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });
  });

  it('ファイルが存在しない場合でも動作する', () => {
    const config = createReloadableSpeakerConfig('/tmp/nonexistent-speaker-test/speakers.yml');
    expect(config.resolve('guild1', 'user1')).toEqual({});
  });

  it('reloadで設定が再読み込みされる', () => {
    const filePath = tmpFile('"guild1":\n  model: zundamon\n  voice: zundamon\n');
    const config = createReloadableSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });

    fs.writeFileSync(filePath, '"guild1":\n  model: alloy\n  voice: nova\n', 'utf-8');
    config.reload();

    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'nova' });
  });

  it('不正な YAML では前の設定を維持する', () => {
    const filePath = tmpFile('"guild1":\n  model: zundamon\n  voice: zundamon\n');
    const config = createReloadableSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });

    fs.writeFileSync(filePath, '"guild1": 123\n', 'utf-8');
    config.reload();

    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'zundamon' });
  });
});

describe('saveUserVoiceSetting', () => {
  it('ファイルが存在しない場合に新規作成する', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
    const filePath = path.join(dir, 'speakers.yml');
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });

  it('既存のギルド設定を維持しつつユーザーを追加する', async () => {
    const filePath = tmpFile('"guild1":\n  model: alloy\n  voice: shimmer\n');
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
    // ギルドデフォルトが他ユーザーに残る
    expect(config.resolve('guild1', 'user2')).toEqual({ model: 'alloy', voice: 'shimmer' });
  });

  it('既存のユーザー設定を上書きする', async () => {
    const yaml = [
      '"guild1":',
      '  users:',
      '    "user1":',
      '      model: alloy',
      '      voice: nova'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });

  it('他のギルドの設定に影響しない', async () => {
    const yaml = [
      '"guild1":',
      '  model: alloy',
      '  voice: shimmer',
      '"guild2":',
      '  model: echo',
      '  voice: fable'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild2', 'user1')).toEqual({ model: 'echo', voice: 'fable' });
  });

  it('他のユーザーの設定に影響しない', async () => {
    const yaml = [
      '"guild1":',
      '  users:',
      '    "user1":',
      '      model: alloy',
      '      voice: nova',
      '    "user2":',
      '      model: echo',
      '      voice: fable'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
    expect(config.resolve('guild1', 'user2')).toEqual({ model: 'echo', voice: 'fable' });
  });

  it('新しいギルドを追加できる', async () => {
    const filePath = tmpFile('"guild1":\n  model: alloy\n  voice: shimmer\n');
    await saveUserVoiceSetting(filePath, 'guild2', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'shimmer' });
    expect(config.resolve('guild2', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });

  it('guild-name と user-name を書き込む', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
    const filePath = path.join(dir, 'speakers.yml');
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' }, 'テストサーバー', 'テストユーザー');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('guild-name: テストサーバー');
    expect(content).toContain('user-name: テストユーザー');

    // 読み込みに影響しないことを確認
    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });

  it('guild-name を既存ギルドでも更新する', async () => {
    const yaml = [
      '"guild1":',
      '  guild-name: 旧名',
      '  users:',
      '    "user1":',
      '      user-name: 旧ユーザー',
      '      model: alloy',
      '      voice: nova'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' }, '新名', '新ユーザー');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('guild-name: 新名');
    expect(content).not.toContain('guild-name: 旧名');
    expect(content).toContain('user-name: 新ユーザー');
    expect(content).not.toContain('user-name: 旧ユーザー');
  });

  it('名前を省略しても動作する', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
    const filePath = path.join(dir, 'speakers.yml');
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('guild-name');
    expect(content).not.toContain('user-name');
  });

  it('他ギルド・他ユーザーの guild-name と user-name を保持する', async () => {
    const yaml = [
      '"guild1":',
      '  guild-name: サーバーA',
      '  users:',
      '    "user1":',
      '      user-name: ユーザーA',
      '      model: alloy',
      '      voice: nova',
      '    "user2":',
      '      user-name: ユーザーB',
      '      model: echo',
      '      voice: fable',
      '"guild2":',
      '  guild-name: サーバーB',
      '  users:',
      '    "user3":',
      '      user-name: ユーザーC',
      '      model: onyx',
      '      voice: shimmer'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await saveUserVoiceSetting(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' }, 'サーバーA', '新ユーザーA');

    const content = fs.readFileSync(filePath, 'utf-8');
    // 更新対象のユーザーは新しい名前
    expect(content).toContain('user-name: 新ユーザーA');
    // 他のユーザー・ギルドの名前は保持される
    expect(content).toContain('user-name: ユーザーB');
    expect(content).toContain('guild-name: サーバーB');
    expect(content).toContain('user-name: ユーザーC');
  });
});

describe('removeUserVoiceSetting', () => {
  it('指定ユーザーの設定を削除する', async () => {
    const yaml = [
      '"guild1":',
      '  users:',
      '    "user1":',
      '      model: zundamon',
      '      voice: normal'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await removeUserVoiceSetting(filePath, 'guild1', 'user1');

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({});
  });

  it('他のユーザーの設定に影響しない', async () => {
    const yaml = [
      '"guild1":',
      '  users:',
      '    "user1":',
      '      model: zundamon',
      '      voice: normal',
      '    "user2":',
      '      model: echo',
      '      voice: fable'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await removeUserVoiceSetting(filePath, 'guild1', 'user1');

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({});
    expect(config.resolve('guild1', 'user2')).toEqual({ model: 'echo', voice: 'fable' });
  });

  it('他のギルドの設定に影響しない', async () => {
    const yaml = [
      '"guild1":',
      '  users:',
      '    "user1":',
      '      model: zundamon',
      '      voice: normal',
      '"guild2":',
      '  users:',
      '    "user1":',
      '      model: echo',
      '      voice: fable'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await removeUserVoiceSetting(filePath, 'guild1', 'user1');

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({});
    expect(config.resolve('guild2', 'user1')).toEqual({ model: 'echo', voice: 'fable' });
  });

  it('存在しないユーザーを指定してもエラーにならない', async () => {
    const filePath = tmpFile('"guild1":\n  model: alloy\n');
    await expect(removeUserVoiceSetting(filePath, 'guild1', 'user1')).resolves.toBeUndefined();
  });

  it('ファイルが存在しなくてもエラーにならない', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
    const filePath = path.join(dir, 'speakers.yml');
    await expect(removeUserVoiceSetting(filePath, 'guild1', 'user1')).resolves.toBeUndefined();
  });

  it('削除後も guild-name と他ユーザーの user-name を保持する', async () => {
    const yaml = [
      '"guild1":',
      '  guild-name: サーバーA',
      '  users:',
      '    "user1":',
      '      user-name: ユーザーA',
      '      model: zundamon',
      '      voice: normal',
      '    "user2":',
      '      user-name: ユーザーB',
      '      model: echo',
      '      voice: fable'
    ].join('\n');
    const filePath = tmpFile(yaml);
    await removeUserVoiceSetting(filePath, 'guild1', 'user1');

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('guild-name: サーバーA');
    expect(content).toContain('user-name: ユーザーB');
    expect(content).not.toContain('user-name: ユーザーA');
  });
});
