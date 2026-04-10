import sharp from 'sharp';
import { downloadBuffer } from './downloader';

export async function processImage (imageUrl: string): Promise<string> {
  const inputBuffer = await downloadBuffer(imageUrl);
  const jpegBuffer = await sharp(inputBuffer)
    .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg()
    .toBuffer();
  return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
}
