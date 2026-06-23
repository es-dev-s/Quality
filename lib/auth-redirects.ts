import { redirect } from "next/navigation";

/** Route handler that clears auth cookies (safe outside Server Actions). */
export const CLEAR_SESSION_PATH = "/api/auth/clear-session";

export type InvalidSessionReason = "session" | "deactivated" | "not_approved";

/**
 * Redirect stale/revoked sessions through a Route Handler so cookies can be cleared
 * without triggering "Cookies can only be modified in a Server Action or Route Handler".
 */
export function redirectForInvalidSession(
  callbackUrl?: string,
  reason: InvalidSessionReason = "session"
): never {
  const params = new URLSearchParams({ reason });
  if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
    params.set("callbackUrl", callbackUrl);
  }
  redirect(`${CLEAR_SESSION_PATH}?${params.toString()}`);
}
