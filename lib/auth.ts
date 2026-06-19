import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { verifyCredentialsForLogin } from "@/lib/auth-credentials";
import { getServerSession } from "@/lib/auth-session";
import {
  AccountDeactivatedError,
  AccountNotApprovedError,
  SessionRevokedError,
} from "@/lib/auth-errors";
import { ensureAuthEnv } from "@/lib/deployment";
import { resolveEffectiveScopes } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/rbac";
import { cache } from "react";

ensureAuthEnv();

const loadSessionUser = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          scopes: { include: { scope: true } },
        },
      },
    },
  });
});

function mapSessionRole(user: NonNullable<Awaited<ReturnType<typeof loadSessionUser>>>): SessionRole {
  const dbScopes = user.role.scopes.map((entry) => entry.scope.slug);
  return {
    id: user.role.id,
    name: user.role.name,
    slug: user.role.slug,
    scopes: resolveEffectiveScopes(user.role.slug, dbScopes),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = token.id as string;
      session.user.sessionVersion = (token.sessionVersion as number) ?? 0;
      session.user.role = token.role as SessionRole;

      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const result = await verifyCredentialsForLogin(email, password);
        if (!result.ok) {
          return null;
        }

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          sessionVersion: result.user.sessionVersion,
        };
      },
    }),
  ],
});

export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const user = await loadSessionUser(session.user.id);
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!user.isActive) {
    throw new AccountDeactivatedError();
  }

  if (user.approvalStatus !== "ACTIVE") {
    throw new AccountNotApprovedError();
  }

  const tokenSessionVersion = Number(session.user.sessionVersion ?? 0);
  const dbSessionVersion = Number(user.sessionVersion ?? 0);
  if (dbSessionVersion > tokenSessionVersion) {
    throw new SessionRevokedError();
  }

  session.user.role = mapSessionRole(user);

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (!isSuperAdmin(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}
