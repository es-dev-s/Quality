import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { ensureAuthEnv } from "@/lib/deployment";
import { canAccessPath } from "@/lib/rbac";
import type { SessionRole } from "@/lib/rbac";
import { NextResponse } from "next/server";

ensureAuthEnv();

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(isLoggedIn ? "/dashboard" : "/login", nextUrl)
    );
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/access-denied")) {
    if (isLoggedIn && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const callbackUrl = encodeURIComponent(pathname + nextUrl.search);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl)
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
    return NextResponse.redirect(new URL(target, nextUrl));
  }

  // JWT role/scopes may be stale until session maxAge expires.
  // Session revocation (deactivate, role change) is enforced in requireAuth()
  // via sessionVersion — middleware only checks route-level scope from JWT.
  const role = req.auth?.user?.role as SessionRole | undefined;
  if (role && !canAccessPath(role, pathname)) {
    return NextResponse.redirect(new URL("/access-denied", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
