const MAX_RETRIES = 3;

export async function withRetry (label: string, fn: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.warn(`${label} (${attempt}/${MAX_RETRIES}): ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}
