import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { buffer as readAll } from 'stream/consumers';

// 合成結果を一意に決めるパラメータ。ひとつでも異なれば別のキャッシュになる
export interface AudioCacheKey {
  text: string;
  model: string;
  voice: string;
  speed: number;
}

// 状態変化通知のように同一内容が繰り返し合成される音声を、
// 速度変換まで済ませた状態でファイルとして保存する。
// エントリの削除は行わないので、増えすぎた場合はディレクトリごと消せば再生成される
export class AudioCache {
  private dir: string;
  private tmpCounter = 0;

  constructor (dir: string) {
    this.dir = dir;
  }

  private filePath (key: AudioCacheKey): string {
    // 各値の長さを含めることで、区切りをまたいだ値の衝突を防ぐ
    const source = JSON.stringify([key.text, key.model, key.voice, key.speed]);
    const hash = createHash('sha256').update(source).digest('hex');
    return path.join(this.dir, `${hash}.opus`);
  }

  // キャッシュがあればそれを、無ければ produce の結果を保存してから返す
  async load (key: AudioCacheKey, produce: () => Promise<Readable>): Promise<Readable> {
    const file = this.filePath(key);

    try {
      const cached = await fs.readFile(file);
      if (cached.length > 0) {
        return Readable.from([cached]);
      }
    } catch {
      // キャッシュ無し・読み取り失敗のどちらも合成にフォールバックする
    }

    const data = await readAll(await produce());
    await this.write(file, data);
    return Readable.from([data]);
  }

  private async write (file: string, data: Buffer): Promise<void> {
    // 空データを保存すると次回以降そのまま再生され無音になる
    if (data.length === 0) {
      return;
    }

    const tmp = `${file}.${process.pid}.${this.tmpCounter++}.tmp`;
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(tmp, data);
      // 書き込み途中のファイルを読ませないため、rename で原子的に差し替える
      await fs.rename(tmp, file);
    } catch (e) {
      // 保存に失敗しても再生は継続できるので警告のみ
      console.warn(`音声キャッシュの書き込みに失敗: ${e instanceof Error ? e.message : e}`);
      await fs.rm(tmp, { force: true }).catch(() => {});
    }
  }
}
