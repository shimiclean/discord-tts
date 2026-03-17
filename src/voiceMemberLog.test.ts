import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VoiceMemberLog } from './voiceMemberLog';

function tmpFile (): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-member-log-'));
  return path.join(dir, 'voice-members.log.yml');
}

describe('VoiceMemberLog', () => {
  describe('record', () => {
    it('ユーザーを記録してファイルに書き出す', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);

      log.record('guild1', 'ギルド名', 'user1', '太郎');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"guild1"');
      expect(content).toContain('ギルド名');
      expect(content).toContain('"user1"');
      expect(content).toContain('太郎');
    });

    it('同一ギルドに複数ユーザーを記録できる', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);

      log.record('guild1', 'ギルド名', 'user1', '太郎');
      log.record('guild1', 'ギルド名', 'user2', '花子');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"user1": 太郎');
      expect(content).toContain('"user2": 花子');
    });

    it('既存ユーザーの表示名を更新する', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);

      log.record('guild1', 'ギルド名', 'user1', '太郎');
      log.record('guild1', 'ギルド名', 'user1', '太郎（改名）');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('太郎（改名）');
      expect(content).not.toMatch(/"user1": 太郎\n/);
    });

    it('複数ギルドを1ファイルにまとめる', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);

      log.record('guild1', 'ギルドA', 'user1', '太郎');
      log.record('guild2', 'ギルドB', 'user2', '花子');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"guild1"');
      expect(content).toContain('ギルドA');
      expect(content).toContain('"guild2"');
      expect(content).toContain('ギルドB');
    });

    it('ギルド名が変わった場合はコメントを更新する', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);

      log.record('guild1', '旧名', 'user1', '太郎');
      log.record('guild1', '新名', 'user2', '花子');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('新名');
      expect(content).not.toContain('旧名');
    });
  });

  describe('既存ファイルの読み込み', () => {
    it('既存ファイルの内容を引き継ぐ', () => {
      const filePath = tmpFile();
      const log1 = new VoiceMemberLog(filePath);
      log1.record('guild1', 'ギルド名', 'user1', '太郎');

      const log2 = new VoiceMemberLog(filePath);
      log2.record('guild1', 'ギルド名', 'user2', '花子');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"user1": 太郎');
      expect(content).toContain('"user2": 花子');
    });

    it('ファイルが存在しない場合は新規作成する', () => {
      const filePath = tmpFile();
      expect(fs.existsSync(filePath)).toBe(false);

      const log = new VoiceMemberLog(filePath);
      log.record('guild1', 'ギルド名', 'user1', '太郎');

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('出力フォーマット', () => {
    it('ヘッダコメントが含まれる', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);
      log.record('guild1', 'ギルド名', 'user1', '太郎');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toMatch(/^# /);
    });

    it('ギルドIDがクォートされている', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);
      log.record('123456', 'ギルド名', 'user1', '太郎');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"123456"');
    });

    it('ユーザーIDがクォートされている', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);
      log.record('guild1', 'ギルド名', '789012', '太郎');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('"789012"');
    });

    it('ユーザーが users キー配下に出力される', () => {
      const filePath = tmpFile();
      const log = new VoiceMemberLog(filePath);
      log.record('guild1', 'ギルド名', 'user1', '太郎');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('  users:\n    "user1": 太郎');
    });
  });
});
