export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type CursorInput = {
  cursor?: string;
  limit?: number;
};

export function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(
    JSON.stringify({ id, t: createdAt.getTime() })
  ).toString("base64url");
}

export function decodeCursor(
  cursor: string
): { id: string; t: number } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { id?: string; t?: number };
    if (typeof parsed.id !== "string" || typeof parsed.t !== "number") {
      return null;
    }
    return { id: parsed.id, t: parsed.t };
  } catch {
    return null;
  }
}

export function cursorWhereClause(
  decoded: { id: string; t: number } | null
): Record<string, unknown> | undefined {
  if (!decoded) return undefined;
  return {
    OR: [
      { createdAt: { lt: new Date(decoded.t) } },
      { createdAt: new Date(decoded.t), id: { lt: decoded.id } },
    ],
  };
}

export function clampLimit(limit: number | undefined, fallback = 50, max = 200) {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(1, Math.floor(limit)), max);
}
