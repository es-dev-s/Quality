import type { NextAuthConfig } from "next-auth";
import type { SessionRole } from "@/lib/rbac";
import {
  buildHttpAuthCookies,
  resolveTrustHost,
  useSecureCookies,
} from "@/lib/auth-cookies";

export const authConfig = {
  trustHost: resolveTrustHost(),
  useSecureCookies,
  ...(useSecureCookies ? {} : { cookies: buildHttpAuthCookies() }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as SessionRole;
      }
      return session;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;

      // Login and root are handled in middleware.ts — do not block here.
      if (pathname === "/" || pathname.startsWith("/login")) {
        return true;
      }

      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
