import { loadChannelFilter } from './channelFilter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempFile (content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));
  const filePath = path.join(dir, 'channels.yml');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('loadChannelFilter', () => {
  describe('ファイルが存在しない場合', () => {
    it('全てのギルド・チャンネルを許可する', () => {
      const filter = loadChannelFilter('/nonexistent/channels.yml');
      expect(filter.isAllowed('guild1', 'ch1')).toBe(true);
      expect(filter.isAllowed('guild2', 'ch2')).toBe(true);
    });
  });

  describe('ファイルが存在する場合', () => {
    it('記載されたギルドの記載されたチャンネルを許可する', () => {
      const filePath = createTempFile([
        '"111":',
        '  - "aaa"',
        '  - "bbb"'
      ].join('\n'));
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('111', 'aaa')).toBe(true);
      expect(filter.isAllowed('111', 'bbb')).toBe(true);
    });

    it('記載されたギルドの記載されていないチャンネルを拒否する', () => {
      const filePath = createTempFile([
        '"111":',
        '  - "aaa"'
      ].join('\n'));
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('111', 'ccc')).toBe(false);
    });

    it('記載されていないギルドは全チャンネルを許可する', () => {
      const filePath = createTempFile([
        '"111":',
        '  - "aaa"'
      ].join('\n'));
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('999', 'anything')).toBe(true);
    });

    it('チャンネルに "*" が指定されたギルドは全チャンネルを許可する', () => {
      const filePath = createTempFile([
        '"111":',
        '  - "*"'
      ].join('\n'));
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('111', 'any-channel')).toBe(true);
      expect(filter.isAllowed('111', 'another-channel')).toBe(true);
    });

    it('複数ギルドの設定を正しく処理する', () => {
      const filePath = createTempFile([
        '"111":',
        '  - "aaa"',
        '"222":',
        '  - "*"',
        '"333":',
        '  - "xxx"',
        '  - "yyy"'
      ].join('\n'));
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('111', 'aaa')).toBe(true);
      expect(filter.isAllowed('111', 'bbb')).toBe(false);
      expect(filter.isAllowed('222', 'anything')).toBe(true);
      expect(filter.isAllowed('333', 'xxx')).toBe(true);
      expect(filter.isAllowed('333', 'zzz')).toBe(false);
      expect(filter.isAllowed('444', 'anything')).toBe(true);
    });

    it('空のファイルの場合は全許可する', () => {
      const filePath = createTempFile('');
      const filter = loadChannelFilter(filePath);
      expect(filter.isAllowed('111', 'aaa')).toBe(true);
    });

    it('不正なYAMLの場合はエラーを投げる', () => {
      const filePath = createTempFile('{{invalid yaml');
      expect(() => loadChannelFilter(filePath)).toThrow();
    });

    it('ギルドの値が配列でない場合はエラーを投げる', () => {
      const filePath = createTempFile('"111": "not-an-array"');
      expect(() => loadChannelFilter(filePath)).toThrow();
    });

    it('配列の要素が文字列でない場合はエラーを投げる', () => {
      const filePath = createTempFile([
        '"111":',
        '  - 123'
      ].join('\n'));
      expect(() => loadChannelFilter(filePath)).toThrow();
    });
  });
});
