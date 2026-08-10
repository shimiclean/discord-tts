const MAX_RETRIES = 3;

// リトライして結果を返す。すべて失敗した場合は最後のエラーを呼び出し元に投げる
export async function withRetryResult<T> (fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// リトライして、すべて失敗した場合は警告ログを出力して握り潰す
export async function withRetry (label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await withRetryResult(fn);
  } catch (e) {
    console.warn(`${label} (${MAX_RETRIES}/${MAX_RETRIES}): ${e instanceof Error ? e.message : e}`);
  }
}
