import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { getServerSession } from "@/lib/auth-session";
import {
  AccountDeactivatedError,
  AccountNotApprovedError,
  SessionRevokedError,
} from "@/lib/auth-errors";
import { ensureAuthEnv } from "@/lib/deployment";
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
  return {
    id: user.role.id,
    name: user.role.name,
    slug: user.role.slug,
    scopes: user.role.scopes.map((entry) => entry.scope.slug),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              role: {
                include: {
                  scopes: {
                    include: { scope: true },
                  },
                },
              },
            },
          });

          if (!user) return null;

          if (!user.isActive) return null;

          if (user.approvalStatus !== "ACTIVE") return null;

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: mapSessionRole(user),
            sessionVersion: user.sessionVersion,
          };
        } catch (error) {
          console.error("[auth] Credentials lookup failed:", error);
          return null;
        }
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

  const tokenSessionVersion = session.user.sessionVersion ?? 0;
  if (user.sessionVersion !== tokenSessionVersion) {
    throw new SessionRevokedError();
  }

  session.user.role = mapSessionRole(user);
  session.user.sessionVersion = user.sessionVersion;

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (!isSuperAdmin(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}
