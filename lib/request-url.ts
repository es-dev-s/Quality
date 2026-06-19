import type { NextRequest } from "next/server";
import { getAppUrl, getPort } from "@/lib/deployment";

const BIND_ALL_HOSTNAMES = new Set(["0.0.0.0", "::", "[::]"]);

/** Server bind addresses — not valid browser destinations. */
export function isBindAllHostname(hostname: string): boolean {
  return BIND_ALL_HOSTNAMES.has(hostname.toLowerCase());
}

type RedirectRequest = Pick<NextRequest, "nextUrl" | "headers">;

/**
 * Build redirect targets that respect APP_URL (production domain) and never
 * send users to 0.0.0.0 when the dev server binds to all interfaces.
 */
export function resolveRedirectUrl(
  path: string,
  request: RedirectRequest | URL
): URL {
  const configured = getAppUrl();
  if (configured) {
    return new URL(path, configured.endsWith("/") ? configured : `${configured}/`);
  }

  const base =
    request instanceof URL
      ? new URL(request.href)
      : request.nextUrl.clone();

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
    base.hostname = "localhost";
    if (!base.port) {
      base.port = String(getPort());
    }
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, base);
}
