import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { ensureAuthEnv } from "@/lib/deployment";
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
