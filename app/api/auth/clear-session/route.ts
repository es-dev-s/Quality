import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { clearAuthCookies } from "@/lib/auth-cookies";
import {
  type InvalidSessionReason,
} from "@/lib/auth-redirects";
import { resolveRedirectUrl } from "@/lib/request-url";

export const dynamic = "force-dynamic";

function safeCallbackUrl(value: string | null): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/login";
}

function safeSessionReason(value: string | null): InvalidSessionReason | null {
  if (
    value === "session" ||
    value === "deactivated" ||
    value === "not_approved"
  ) {
    return value;
  }
  return null;
}

/**
 * Clears auth cookies via Route Handler (works on HTTP LAN; no Server Action origin check).
 * Used for Sign out and forced session expiry (?reason=session|deactivated|not_approved).
 */
export async function GET(request: NextRequest) {
  const callbackUrl = safeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl")
  );
  const sessionReason = safeSessionReason(
    request.nextUrl.searchParams.get("reason")
  );

  await signOut({ redirect: false });

  const loginUrl = resolveRedirectUrl("/login", request);
  if (sessionReason) {
    loginUrl.searchParams.set("reason", sessionReason);
  }
  if (callbackUrl !== "/login") {
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return clearAuthCookies(NextResponse.redirect(loginUrl));
}
