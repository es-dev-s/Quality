function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Next.js data cache rejects payloads over 2MB — not a database outage. */
export function isNextDataCacheOverflowError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("over 2mb can not be cached") ||
    message.includes("items over 2mb")
  );
}

export function isRetryableDbError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("emaxconn") ||
    message.includes("p2028") ||
    message.includes("connection terminated") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("too many connections")
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 350;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (
        isNextDataCacheOverflowError(error) ||
        !isRetryableDbError(error) ||
        attempt === attempts - 1
      ) {
        throw error;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}
