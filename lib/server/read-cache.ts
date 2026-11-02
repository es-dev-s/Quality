/** Small result cache shared by server chunks. Never caches raw audit datasets. */
type Entry = { value: unknown; expires: number; bytes: number };
type State = { version: number; entries: Map<string, Entry>; pending: Map<string, Promise<unknown>> };
const root = globalThis as typeof globalThis & { __qualityReadCache?: State };
const state = root.__qualityReadCache ??= { version: 0, entries: new Map(), pending: new Map() };
const TTL = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;

export function invalidateReadResults() {
  state.version++;
  state.entries.clear();
  state.pending.clear();
}

export async function cachedReadResult<T>(key: string, load: () => Promise<T>): Promise<T> {
  const version = state.version;
  const cacheKey = `${version}:${key}`;
  const entry = state.entries.get(cacheKey);
  if (entry && entry.expires > Date.now()) {
    state.entries.delete(cacheKey);
    state.entries.set(cacheKey, entry);
    return entry.value as T;
  }
  const pending = state.pending.get(cacheKey);
  if (pending) return pending as Promise<T>;
  const work = load().then((value) => {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if (version === state.version && bytes <= MAX_BYTES) {
      for (const [key, value] of state.entries) if (value.expires <= Date.now()) state.entries.delete(key);
      while (state.entries.size >= 8) state.entries.delete(state.entries.keys().next().value!);
      state.entries.set(cacheKey, { value, bytes, expires: Date.now() + TTL });
    }
    return value;
  }).finally(() => state.pending.delete(cacheKey));
  state.pending.set(cacheKey, work);
  return work;
}
