import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { getServerSession } from "@/lib/auth-session";
import { ensureAuthEnv } from "@/lib/deployment";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/rbac";
import { SUPERADMIN_ROLE_SLUG } from "@/lib/constants";
import { cache } from "react";

ensureAuthEnv();

const loadSessionRole = cache(async (userId: string): Promise<SessionRole | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          scopes: { include: { scope: true } },
        },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.role.id,
    name: user.role.name,
    slug: user.role.slug,
    scopes: user.role.scopes.map((entry) => entry.scope.slug),
  };
});

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

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return null;

          const role: SessionRole = {
            id: user.role.id,
            name: user.role.name,
            slug: user.role.slug,
            scopes: user.role.scopes.map((rs) => rs.scope.slug),
          };

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role,
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

  const freshRole = await loadSessionRole(session.user.id);
  if (freshRole) {
    session.user.role = freshRole;
  }

  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (!isSuperAdmin(session.user.role)) {
    throw new Error("Forbidden");
  }
  return session;
}
