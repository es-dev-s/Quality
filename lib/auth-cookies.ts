/** Edge-safe auth cookie settings (direct process.env reads for middleware bundle). */

export function resolveUseSecureCookies(): boolean {
  const explicit = process.env.AUTH_SECURE_COOKIES?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  const url = process.env.APP_URL ?? process.env.AUTH_URL ?? "";
  return url.startsWith("https://");
}

export function resolveTrustHost(): boolean {
  const flag = process.env.AUTH_TRUST_HOST?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !(process.env.APP_URL ?? process.env.AUTH_URL)?.trim();
}

/** Pin non-secure cookie names on HTTP so middleware and login handler stay in sync. */
export function buildHttpAuthCookies() {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: false,
  };

  return {
    sessionToken: {
      name: "authjs.session-token",
      options: base,
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: base,
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: base,
    },
  };
}

export const useSecureCookies = resolveUseSecureCookies();
