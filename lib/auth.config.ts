import type { NextAuthConfig } from "next-auth";
import type { SessionRole } from "@/lib/rbac";
import { shouldTrustHost, shouldUseSecureCookies } from "@/lib/deployment";

export const authConfig = {
  trustHost: shouldTrustHost(),
  useSecureCookies: shouldUseSecureCookies(),
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
      const isLoggedIn = !!auth?.user;
      const isLoginPage = pathname.startsWith("/login");

      if (pathname === "/") {
        return false;
      }

      if (isLoginPage) {
        return !isLoggedIn;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
