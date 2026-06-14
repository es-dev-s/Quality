type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Lightweight in-process rate limiter for write Server Actions.
 * Suitable for single-instance or low-traffic; use Redis/Upstash at scale.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function rateLimitError(retryAfterMs: number): { error: string } {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return {
    error: `Too many requests. Please wait ${seconds}s and try again.`,
  };
}

export function assertWriteRateLimit(
  userId: string,
  action: string,
  options?: { limit?: number; windowMs?: number }
): { error: string } | null {
  const limit = options?.limit ?? 30;
  const windowMs = options?.windowMs ?? 60_000;
  const result = checkRateLimit(`${action}:${userId}`, limit, windowMs);
  if (!result.allowed) {
    return rateLimitError(result.retryAfterMs);
  }
  return null;
}
