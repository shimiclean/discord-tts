import { loadYamlAsObject } from './yamlLoader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempFile (content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaml-'));
  const filePath = path.join(dir, 'test.yml');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('loadYamlAsObject', () => {
  describe('ファイルが存在しない場合', () => {
    it('nullを返す', () => {
      const result = loadYamlAsObject('/nonexistent/test.yml', 'エラー');
      expect(result).toBeNull();
    });
  });

  describe('ファイルが空の場合', () => {
    it('nullを返す', () => {
      const result = loadYamlAsObject(createTempFile(''), 'エラー');
      expect(result).toBeNull();
    });
  });

  describe('nullのみの場合', () => {
    it('nullを返す', () => {
      const result = loadYamlAsObject(createTempFile('null'), 'エラー');
      expect(result).toBeNull();
    });
  });

  describe('有効なオブジェクトの場合', () => {
    it('パースされたオブジェクトを返す', () => {
      const result = loadYamlAsObject(createTempFile('key: value'), 'エラー');
      expect(result).toEqual({ key: 'value' });
    });

    it('複数キーのオブジェクトを返す', () => {
      const content = [
        '"guild1":',
        '  model: zundamon',
        '"guild2":',
        '  model: alloy'
      ].join('\n');
      const result = loadYamlAsObject(createTempFile(content), 'エラー');
      expect(result).toEqual({
        guild1: { model: 'zundamon' },
        guild2: { model: 'alloy' }
      });
    });
  });

  describe('配列の場合', () => {
    it('指定されたエラーメッセージで例外を投げる', () => {
      expect(() => loadYamlAsObject(createTempFile('- item1\n- item2'), 'テスト用エラー'))
        .toThrow('テスト用エラー');
    });
  });

  describe('スカラーの場合', () => {
    it('指定されたエラーメッセージで例外を投げる', () => {
      expect(() => loadYamlAsObject(createTempFile('"just a string"'), 'テスト用エラー'))
        .toThrow('テスト用エラー');
    });
  });

  describe('不正なYAMLの場合', () => {
    it('yamlパーサーのエラーをそのまま投げる', () => {
      expect(() => loadYamlAsObject(createTempFile('{{invalid'), 'エラー'))
        .toThrow();
    });
  });
});
