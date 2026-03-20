export interface DownloadResult extends Buffer {
  contentType: string;
}

export async function downloadBuffer (url: string): Promise<DownloadResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ダウンロードに失敗: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer()) as DownloadResult;
  buffer.contentType = response.headers.get('content-type') ?? '';
  return buffer;
}
