import {
  collectConfiguredOrigins,
  getAppUrl,
  getPort,
  isBindAllHostname,
  isLocalOnlyAppUrl,
  isValidRedirectHostname,
  shouldTrustHost,
} from "@/lib/deployment";

type RedirectRequest = {
  nextUrl: { href: string };
  headers: { get(name: string): string | null };
};

function normalizeOriginKey(host: string): string {
  return host.trim().toLowerCase();
}

function hostnameFromHost(host: string): string {
  return normalizeOriginKey(host).split(":")[0] ?? "";
}

function isAllowedRequestHost(host: string): boolean {
  const hostname = hostnameFromHost(host);

  if (shouldTrustHost() && isValidRedirectHostname(hostname)) {
    return true;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  const allowed = new Set(
    collectConfiguredOrigins().map((entry) => normalizeOriginKey(entry))
  );

  const key = normalizeOriginKey(host);
  return (
    allowed.has(key) ||
    allowed.has(hostname) ||
    allowed.has(host)
  );
}

function cloneRequestUrl(request: RedirectRequest | URL): URL {
  if (request instanceof URL) {
    return new URL(request.href);
  }
  return new URL(request.nextUrl.href);
}

function applyForwardedHeaders(base: URL, request: RedirectRequest): URL {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (!forwardedHost) return base;

  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    base.protocol.replace(":", "");

  return new URL(
    `${base.pathname}${base.search}`,
    `${forwardedProto}://${forwardedHost}`
  );
}

function originFromUrl(base: URL): string | null {
  if (isBindAllHostname(base.hostname)) {
    return null;
  }
  if (!isAllowedRequestHost(base.host)) {
    return null;
  }
  return `${base.protocol}//${base.host}`;
}

/**
 * Origin from the incoming browser request (Host / X-Forwarded-*).
 * Returns null when the host is the server bind address (0.0.0.0) or unknown.
 */
export function resolveRequestOrigin(
  request: RedirectRequest | URL
): string | null {
  let base = cloneRequestUrl(request);
  if (!(request instanceof URL)) {
    base = applyForwardedHeaders(base, request);
  }
  return originFromUrl(base);
}

/**
 * Build redirect targets from the browser's current host when possible.
 * APP_URL is a fallback for bind-all addresses without forwarded headers — never
 * forces localhost when the browser arrived on a real domain (AUTH_TRUST_HOST).
 */
export function resolveRedirectUrl(
  path: string,
  request: RedirectRequest | URL
): URL {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const requestOrigin = resolveRequestOrigin(request);
  if (requestOrigin) {
    return new URL(normalizedPath, `${requestOrigin}/`);
  }

  let base = cloneRequestUrl(request);
  if (!(request instanceof URL)) {
    base = applyForwardedHeaders(base, request);
  }

  // Trust-host: use request URL even when APP_URL is a stale localhost dev value.
  if (shouldTrustHost()) {
    const trusted = originFromUrl(base);
    if (trusted) {
      return new URL(normalizedPath, `${trusted}/`);
    }
  }

  const configured = getAppUrl();
  const skipLocalAppUrl =
    shouldTrustHost() &&
    isLocalOnlyAppUrl() &&
    isValidRedirectHostname(base.hostname) &&
    !isBindAllHostname(base.hostname);

  if (configured && !skipLocalAppUrl) {
    return new URL(
      normalizedPath,
      configured.endsWith("/") ? configured : `${configured}/`
    );
  }

  if (isBindAllHostname(base.hostname)) {
    base.hostname = "localhost";
    if (!base.port) {
      base.port = String(getPort());
    }
  }

  return new URL(normalizedPath, base);
}
