/** pg v8 treats sslmode=require as verify-full; libpq compat avoids TLS chain errors on Supabase. */
function withSsl(url: string): string {
  let next = url;

  if (!/uselibpqcompat=/i.test(next)) {
    const separator = next.includes("?") ? "&" : "?";
    next = `${next}${separator}uselibpqcompat=true`;
  }

  if (!/sslmode=/i.test(next)) {
    const separator = next.includes("?") ? "&" : "?";
    next = `${next}${separator}sslmode=require`;
  }

  return next;
}

function isPoolerHost(url: string): boolean {
  return url.includes(".pooler.supabase.com");
}

function isDirectSupabaseDbHost(url: string): boolean {
  return /db\.[^./]+\.supabase\.co/i.test(url);
}

/** Use session pooler port when only transaction URL is configured. */
export function toSessionPoolerUrl(url: string): string {
  let next = url;

  if (next.includes(":6543")) {
    next = next.replace(":6543", ":5432");
  }

  next = next.replace(/([?&])pgbouncer=true&?/i, "$1");
  next = next.replace(/\?&/g, "?").replace(/[?&]$/, "");

  return withSsl(next);
}

export function resolveDatabaseUrl(): string {
  const session = process.env.DATABASE_URL_SESSION?.trim();
  const database = process.env.DATABASE_URL?.trim();
  const direct = process.env.DIRECT_URL?.trim();

  if (session) {
    return isPoolerHost(session) ? toSessionPoolerUrl(session) : withSsl(session);
  }

  if (database && isPoolerHost(database)) {
    return toSessionPoolerUrl(database);
  }

  if (direct && isPoolerHost(direct)) {
    return toSessionPoolerUrl(direct);
  }

  if (database) {
    return withSsl(database);
  }

  if (direct && isDirectSupabaseDbHost(direct)) {
    throw new Error(
      "DIRECT_URL points to db.*.supabase.co, which is often unreachable from local/dev runtime. " +
        "Set DATABASE_URL to your Supabase pooler URL (pooler.supabase.com) or add DATABASE_URL_SESSION with the Session pooler on port 5432."
    );
  }

  if (direct) {
    return withSsl(direct);
  }

  throw new Error(
    "DATABASE_URL is not set. Configure Supabase pooler URLs in .env (see .env.example)."
  );
}

export function describeDatabaseHost(url: string): string {
  try {
    const normalized = url.replace(/^postgresql:/i, "http:");
    const parsed = new URL(normalized);
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "unknown";
  }
}
