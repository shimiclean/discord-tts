import { spawn } from 'child_process';
import { downloadBuffer } from './downloader';

export async function processImage (imageUrl: string): Promise<string> {
  const inputBuffer = await downloadBuffer(imageUrl);
  const jpegBuffer = await convertImage(inputBuffer);
  return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
}

function convertImage (input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
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

    const chunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`convert がコード ${code} で終了しました`));
      }
    });
    proc.on('error', reject);
    proc.stdin.write(input);
    proc.stdin.end();
  });
}
