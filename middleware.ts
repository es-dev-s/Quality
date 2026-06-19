import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { ensureAuthEnv } from "@/lib/deployment";
import { resolveRedirectUrl } from "@/lib/request-url";
import { NextResponse } from "next/server";

ensureAuthEnv();

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  if (pathname === "/") {
    return NextResponse.redirect(
      resolveRedirectUrl(isLoggedIn ? "/dashboard" : "/login", req)
    );
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/access-denied")) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
    return NextResponse.redirect(
      resolveRedirectUrl(`/login?callbackUrl=${callbackUrl}`, req)
    );
  }

  if (pathname.startsWith("/admin")) {
    const tabByPath: Record<string, string> = {
      "/admin/users": "users",
      "/admin/roles": "roles",
      "/admin/access": "agents",
    };
    const tab = tabByPath[pathname];
    const target = tab ? `/settings?tab=${tab}` : "/settings";
    return NextResponse.redirect(resolveRedirectUrl(target, req));
  }

  // Route permissions are enforced server-side in requirePageAccess with a fresh
  // DB role. Middleware only verifies authentication so RBAC updates apply
  // without forcing everyone to sign in again.
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
