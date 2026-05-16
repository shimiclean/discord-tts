import { spawn } from 'child_process';
import { Readable } from 'stream';

export const DEFAULT_TTS_SPEED = 1.5;

export function applySpeedFilter (audioBuffer: Buffer, speed: number = DEFAULT_TTS_SPEED): Readable {
  const proc = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-filter:a', `atempo=${speed}`,
    '-f', 'opus',
    'pipe:1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  proc.stdin.end(audioBuffer);

  proc.on('error', (err) => {
    proc.stdout.destroy(err);
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      proc.stdout.destroy(new Error(`ffmpeg atempo 終了コード: ${code}`));
    }
  });

  return proc.stdout;
}
