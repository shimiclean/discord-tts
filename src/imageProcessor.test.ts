import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { processImage } from './imageProcessor';

// child_process.spawn のモック
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args)
}));

// downloader のモック
const mockDownloadBuffer = jest.fn();
jest.mock('./downloader', () => ({
  downloadBuffer: (...args: unknown[]) => mockDownloadBuffer(...args)
}));

function createMockProcess (outputBuffer: Buffer, exitCode: number = 0) {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
  };
  proc.stdin = new Writable({ write (_chunk, _enc, cb) { cb(); } });
  proc.stdout = new Readable({
    read () {
      this.push(outputBuffer);
      this.push(null);
    }
  });
  proc.stderr = new Readable({
    read () {
      this.push(null);
    }
  });
  proc.stdout.on('end', () => {
    process.nextTick(() => proc.emit('close', exitCode));
  });
  return proc;
}

describe('processImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('画像をダウンロードしてリサイズ・JPEG変換し、data URI を返す', async () => {
    const inputBuffer = Buffer.from('fake-image-input');
    const outputBuffer = Buffer.from('fake-jpeg-output');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockSpawn.mockReturnValue(createMockProcess(outputBuffer));

    const result = await processImage('https://cdn.example.com/image.png');

    const expectedBase64 = outputBuffer.toString('base64');
    expect(result).toBe(`data:image/jpeg;base64,${expectedBase64}`);
  });

  it('ImageMagick convert に正しい引数を渡す', async () => {
    const inputBuffer = Buffer.from('fake-image-input');
    const outputBuffer = Buffer.from('fake-jpeg-output');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockSpawn.mockReturnValue(createMockProcess(outputBuffer));

    await processImage('https://cdn.example.com/image.png');

    expect(mockSpawn).toHaveBeenCalledWith(
      'convert',
      [
        '-',
        '-resize', '1000x1000>',
        '-background', 'white',
        '-flatten',
        'jpeg:-'
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
  });

  it('ダウンロードした画像データを convert の stdin に書き込む', async () => {
    const inputBuffer = Buffer.from('fake-image-input');
    const outputBuffer = Buffer.from('fake-jpeg-output');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);

    const writtenChunks: Buffer[] = [];
    const proc = createMockProcess(outputBuffer);
    proc.stdin = new Writable({
      write (chunk, _enc, cb) {
        writtenChunks.push(Buffer.from(chunk));
        cb();
      }
    });

    mockSpawn.mockReturnValue(proc);

    await processImage('https://cdn.example.com/image.png');

    const written = Buffer.concat(writtenChunks);
    expect(written.toString()).toBe('fake-image-input');
  });

  it('ダウンロードに失敗した場合はエラーを伝播する', async () => {
    mockDownloadBuffer.mockRejectedValue(new Error('ダウンロードに失敗: HTTP 404'));

    await expect(processImage('https://cdn.example.com/image.png'))
      .rejects.toThrow('ダウンロードに失敗: HTTP 404');
  });

  it('convert が非ゼロ終了コードで失敗した場合はエラーを投げる', async () => {
    const inputBuffer = Buffer.from('fake-image-input');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);
    mockSpawn.mockReturnValue(createMockProcess(Buffer.alloc(0), 1));

    await expect(processImage('https://cdn.example.com/image.png'))
      .rejects.toThrow('convert がコード 1 で終了しました');
  });

  it('convert プロセスの起動に失敗した場合はエラーを伝播する', async () => {
    const inputBuffer = Buffer.from('fake-image-input');

    mockDownloadBuffer.mockResolvedValue(inputBuffer);

    const proc = new EventEmitter() as EventEmitter & {
      stdin: Writable;
      stdout: Readable;
      stderr: Readable;
    };
    proc.stdin = new Writable({ write (_chunk, _enc, cb) { cb(); } });
    proc.stdout = new Readable({ read () { this.push(null); } });
    proc.stderr = new Readable({ read () { this.push(null); } });
    process.nextTick(() => proc.emit('error', new Error('spawn convert ENOENT')));

    mockSpawn.mockReturnValue(proc);

    await expect(processImage('https://cdn.example.com/image.png'))
      .rejects.toThrow('spawn convert ENOENT');
  });
});
