import type { NextRequest } from "next/server";
import {
  collectConfiguredOrigins,
  getAppUrl,
  getPort,
} from "@/lib/deployment";

const BIND_ALL_HOSTNAMES = new Set(["0.0.0.0", "::", "[::]"]);

/** Server bind addresses — not valid browser destinations. */
export function isBindAllHostname(hostname: string): boolean {
  return BIND_ALL_HOSTNAMES.has(hostname.toLowerCase());
}

type RedirectRequest = Pick<NextRequest, "nextUrl" | "headers">;

function normalizeOriginKey(host: string): string {
  return host.trim().toLowerCase();
}

function isAllowedRequestHost(host: string): boolean {
  const key = normalizeOriginKey(host);
  const hostname = key.split(":")[0] ?? key;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  const allowed = new Set(
    collectConfiguredOrigins().map((entry) => normalizeOriginKey(entry))
  );

  return (
    allowed.has(key) ||
    allowed.has(hostname) ||
    allowed.has(host)
  );
}

/**
 * Origin from the incoming browser request (Host / X-Forwarded-*).
 * Returns null when the host is the server bind address (0.0.0.0) or unknown.
 */
export function resolveRequestOrigin(
  request: RedirectRequest | URL
): string | null {
  const base =
    request instanceof URL ? new URL(request.href) : request.nextUrl.clone();

  if (!(request instanceof URL)) {
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    if (forwardedHost) {
      const forwardedProto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
        base.protocol.replace(":", "");
      base.protocol = `${forwardedProto}:`;
      base.host = forwardedHost;
    }
  }

  if (isBindAllHostname(base.hostname)) {
    return null;
  }

  if (!isAllowedRequestHost(base.host)) {
    return null;
  }

  return `${base.protocol}//${base.host}`;
}

/**
 * Build redirect targets from the browser's current host when possible.
 * APP_URL is a fallback for bind-all addresses and unknown hosts — not a forced redirect target.
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

  const configured = getAppUrl();
  if (configured) {
    return new URL(
      normalizedPath,
      configured.endsWith("/") ? configured : `${configured}/`
    );
  }

  const base =
    request instanceof URL ? new URL(request.href) : request.nextUrl.clone();

  if (isBindAllHostname(base.hostname)) {
    base.hostname = "localhost";
    if (!base.port) {
      base.port = String(getPort());
    }
  }

  return new URL(normalizedPath, base);
}
