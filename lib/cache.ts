import { cache } from "react";

export const CACHE_TAGS = {
  USERS: "users",
  AUDIT_SUBMISSIONS: "audit-submissions",
  AUDIT_TEMPLATES: "audit-templates",
  AGENTS: "agents",
  ROLES: "roles",
  AGENT_ASSIGNMENTS: "agent-assignments",
  INTERACTION_CONFIGS: "interaction-configs",
  userAudits: (userId: string) => `user-audits:${userId}`,
  userAgents: (userId: string) => `user-agents:${userId}`,
  userDashboard: (userId: string) => `dashboard:${userId}`,
} as const;

export const CACHE_TTL = {
  REALTIME: 10,
  STANDARD: 60,
  STATIC: 300,
  FOREVER: 86_400,
} as const;

/** Request-level dedup within a single render pass. */
export const getCachedUserById = cache(async (userId: string) => {
  const { prisma } = await import("@/lib/prisma");
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

export const getCachedRoles = cache(async () => {
  const { prisma } = await import("@/lib/prisma");
  return prisma.role.findMany({
    include: {
      scopes: { include: { scope: true } },
    },
    orderBy: { name: "asc" },
  });
});

export type CacheScopeKey = {
  userId: string;
  roleSlug: string;
  roleScopes: string[];
  userName: string | null;
  userEmail: string;
};

export function cacheScopeKey(scope: CacheScopeKey): string {
  return `${scope.userId}:${scope.roleSlug}`;
}

export function cacheScopeFromSession(session: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: { slug: string; scopes: string[] };
  };
}): CacheScopeKey {
  return {
    userId: session.user.id,
    roleSlug: session.user.role.slug,
    roleScopes: session.user.role.scopes,
    userName: session.user.name ?? null,
    userEmail: session.user.email ?? "",
  };
}
