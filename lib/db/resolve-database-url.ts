function isPrivateOrLocalHost(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgresql:/i, "http:")).hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return true;
    }
    // RFC1918 / common lab ranges
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/** pg v8 treats sslmode=require as verify-full; libpq compat avoids TLS chain errors on Supabase. */
function withSsl(url: string): string {
  let next = url;

  // LAN / local Postgres usually has no TLS — don't force require.
  if (isPrivateOrLocalHost(next)) {
    if (!/sslmode=/i.test(next)) {
      const separator = next.includes("?") ? "&" : "?";
      next = `${next}${separator}sslmode=disable`;
    }
    return next;
  }

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

const POOLER_HINT =
  "Unable to reach the database. Use the Supabase session pooler (pooler.supabase.com:5432) in DATABASE_URL or DATABASE_URL_SESSION — not db.*.supabase.co.";

function isPoolerHost(url: string): boolean {
  return url.includes(".pooler.supabase.com");
}

function isDirectSupabaseDbHost(url: string): boolean {
  return /db\.[^./]+\.supabase\.co/i.test(url);
}

function usableRuntimeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (isDirectSupabaseDbHost(url)) return undefined;
  return isPoolerHost(url) ? toSessionPoolerUrl(url) : withSsl(url);
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

  const picked =
    usableRuntimeUrl(session) ??
    usableRuntimeUrl(database) ??
    usableRuntimeUrl(direct);

  if (picked) return picked;

  if (
    isDirectSupabaseDbHost(session ?? "") ||
    isDirectSupabaseDbHost(database ?? "") ||
    isDirectSupabaseDbHost(direct ?? "")
  ) {
    throw new Error(POOLER_HINT);
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
