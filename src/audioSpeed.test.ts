import { applySpeedFilter, DEFAULT_TTS_SPEED } from './audioSpeed';
import { ChildProcess, spawn } from 'child_process';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';

jest.mock('child_process');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createMockProcess (): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  proc.stdin = new PassThrough() as any;
  proc.stdout = new PassThrough() as any;
  proc.stderr = new PassThrough() as any;
  return proc;
}

describe('applySpeedFilter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ffmpegをatemoフィルタ付きで起動する', () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy audio');

    applySpeedFilter(input, 1.5);

    expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', [
      '-i', 'pipe:0',
      '-filter:a', 'atempo=1.5',
      '-f', 'opus',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
  });

  it('入力バッファをffmpegのstdinに書き込む', (done) => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('test audio data');

    const chunks: Buffer[] = [];
    (proc.stdin as PassThrough).on('data', (chunk) => chunks.push(chunk));
    (proc.stdin as PassThrough).on('end', () => {
      expect(Buffer.concat(chunks).toString()).toBe('test audio data');
      done();
    });

    applySpeedFilter(input, 1.5);
  });

  it('ffmpegのstdoutをReadableストリームとして返す', () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    const result = applySpeedFilter(input, 1.5);

    expect(result).toBe(proc.stdout);
  });

  it('速度値が引数通りに設定される', () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    applySpeedFilter(input, 2.0);

    expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-filter:a', 'atempo=2'
    ]), expect.any(Object));
  });

  it('DEFAULT_TTS_SPEED は 1.5（標準読み上げ速度）', () => {
    expect(DEFAULT_TTS_SPEED).toBe(1.5);
  });

  it('速度を省略した場合 DEFAULT_TTS_SPEED で再生される', () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    applySpeedFilter(input);

    expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-filter:a', `atempo=${DEFAULT_TTS_SPEED}`
    ]), expect.any(Object));
  });

  it('ffmpegプロセスがエラーを出した場合、stdoutがエラーを発行する', (done) => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    const result = applySpeedFilter(input, 1.5);
    result.on('error', (err) => {
      expect(err.message).toBe('ffmpeg失敗');
      done();
    });

    proc.emit('error', new Error('ffmpeg失敗'));
  });

  it('ffmpegが非ゼロ終了コードの場合、stdoutがエラーを発行する', (done) => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    const result = applySpeedFilter(input, 1.5);
    result.on('error', (err) => {
      expect(err.message).toContain('終了コード: 1');
      done();
    });

    proc.emit('close', 1);
  });

  it('ffmpegが正常終了（コード0）の場合はエラーを発行しない', (done) => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);
    const input = Buffer.from('dummy');

    const result = applySpeedFilter(input, 1.5);
    result.on('error', () => {
      done.fail('エラーが発行されるべきではない');
    });

    proc.emit('close', 0);

    setTimeout(done, 50);
  });
});
