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

/** All Auth.js cookie names that may exist across HTTP/HTTPS deployments. */
export const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
] as const;

type CookieCarrier = {
  cookies: {
    delete: (name: string) => void;
    set: (
      name: string,
      value: string,
      options?: {
        path?: string;
        maxAge?: number;
        httpOnly?: boolean;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
      }
    ) => void;
  };
};

/** Force-delete auth cookies even when signOut misses a variant (common on mixed HTTP/HTTPS). */
export function clearAuthCookies<T extends CookieCarrier>(response: T): T {
  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.delete(name);
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure:
        name.startsWith("__Secure-") ||
        name.startsWith("__Host-") ||
        useSecureCookies,
    });
  }
  return response;
}
