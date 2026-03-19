import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadSpeakerConfig, createReloadableSpeakerConfig, updateSpeakerFile } from './speakerConfig';

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

describe('updateSpeakerFile', () => {
  it('ファイルが存在しない場合に新規作成する', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speaker-'));
    const filePath = path.join(dir, 'speakers.yml');
    await updateSpeakerFile(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });

  it('既存のギルド設定を維持しつつユーザーを追加する', async () => {
    const filePath = tmpFile('"guild1":\n  model: alloy\n  voice: shimmer\n');
    await updateSpeakerFile(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

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
    await updateSpeakerFile(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

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
    await updateSpeakerFile(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

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
    await updateSpeakerFile(filePath, 'guild1', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
    expect(config.resolve('guild1', 'user2')).toEqual({ model: 'echo', voice: 'fable' });
  });

  it('新しいギルドを追加できる', async () => {
    const filePath = tmpFile('"guild1":\n  model: alloy\n  voice: shimmer\n');
    await updateSpeakerFile(filePath, 'guild2', 'user1', { model: 'zundamon', voice: 'normal' });

    const config = loadSpeakerConfig(filePath);
    expect(config.resolve('guild1', 'user1')).toEqual({ model: 'alloy', voice: 'shimmer' });
    expect(config.resolve('guild2', 'user1')).toEqual({ model: 'zundamon', voice: 'normal' });
  });
});
