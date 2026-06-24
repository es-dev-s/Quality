/** Edge-safe deployment helpers (no Node.js built-ins). */

export function ensureAuthEnv(): void {
  if (!process.env.AUTH_SECRET?.trim()) {
    throw new Error("AUTH_SECRET is required — app cannot start");
  }

  if (!process.env.DATABASE_URL?.trim() && !process.env.DATABASE_URL_SESSION?.trim()) {
    throw new Error("DATABASE_URL is required");
  }

  const appUrl = process.env.APP_URL?.trim();
  // Pin AUTH_URL only when host is not inferred from each request (reverse proxy / fixed domain).
  // With AUTH_TRUST_HOST=true, NextAuth and redirects should follow the browser URL (localhost vs LAN IP vs domain).
  if (appUrl && !process.env.AUTH_URL?.trim() && !shouldTrustHost()) {
    process.env.AUTH_URL = appUrl;
  }
}

export function getPort(): number {
  const parsed = Number(process.env.PORT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4782;
}

export function getAppUrl(): string | undefined {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return raw || undefined;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function shouldTrustHost(): boolean {
  const flag = process.env.AUTH_TRUST_HOST?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !getAppUrl();
}

export function shouldUseSecureCookies(): boolean {
  const explicit = process.env.AUTH_SECURE_COOKIES?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  const url = getAppUrl();
  if (url) return url.startsWith("https://");

  // Production over plain HTTP (LAN / Windows Server without TLS): secure cookies
  // are dropped by browsers and login loops back to /login.
  return false;
}

function hostsFromUrl(url: string): string[] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const hostPort = parsed.port ? `${host}:${parsed.port}` : host;
    return hostPort === host ? [hostPort] : [hostPort, host];
  } catch {
    return [];
  }
}

function normalizeOriginEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

/** Hosts from env + app URL (Edge-safe). */
export function collectConfiguredOrigins(): string[] {
  const origins = new Set<string>();
  const port = getPort();

  for (const local of [
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    "localhost",
    "127.0.0.1",
  ]) {
    origins.add(local);
  }

  const appUrl = getAppUrl();
  if (appUrl) {
    for (const host of hostsFromUrl(appUrl)) {
      origins.add(host);
    }
  }

  for (const list of [process.env.ALLOWED_ORIGINS, process.env.ALLOWED_DEV_ORIGINS]) {
    if (!list) continue;
    for (const item of list.split(",")) {
      const normalized = normalizeOriginEntry(item);
      if (normalized) origins.add(normalized);
    }
  }

  return Array.from(origins);
}
