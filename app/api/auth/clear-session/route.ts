import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth";
import { resolveRedirectUrl } from "@/lib/request-url";

export const dynamic = "force-dynamic";

function safeCallbackUrl(value: string | null): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/login";
}

/**
 * Clears auth cookies via Route Handler (works on HTTP LAN; no Server Action origin check).
 * Used for Sign out and forced session expiry (?reason=session).
 */
export async function GET(request: NextRequest) {
  const callbackUrl = safeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl")
  );
  const sessionReason = request.nextUrl.searchParams.get("reason");

  await signOut({ redirect: false });

  const loginUrl = resolveRedirectUrl("/login", request);
  if (sessionReason === "session") {
    loginUrl.searchParams.set("reason", "session");
  }
  if (callbackUrl !== "/login") {
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return NextResponse.redirect(loginUrl);
}
