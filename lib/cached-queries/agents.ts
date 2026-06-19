import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_TTL, cacheScopeKey, type CacheScopeKey } from "@/lib/cache";
import { fetchAgentRoleUsers } from "@/lib/audit/role-users";
import { fetchAuditCountsByAgentName } from "@/lib/audit/agent-db";
import { canManageSettings, canManageUsers, canReadManagedUsers } from "@/lib/rbac";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { SessionRole } from "@/lib/rbac";

export type CachedAgentRow = {
  id: string;
  name: string;
  email: string;
  hasProfileName: boolean;
  dateOfJoining: string | null;
  auditCount: number;
  createdAt: string;
};

function roleFromScope(scope: CacheScopeKey): SessionRole {
  return {
    id: "",
    name: "",
    slug: scope.roleSlug,
    scopes: scope.roleScopes,
  };
}

export function getCachedAgentsForManagement(scope: CacheScopeKey) {
  const key = cacheScopeKey(scope);
  const role = roleFromScope(scope);

  return unstable_cache(
    async (): Promise<{ agents: CachedAgentRow[]; canManage: boolean }> => {
      const allowed =
        canManageSettings(role) ||
        canManageUsers(role) ||
        canReadManagedUsers(role);
      if (!allowed) {
        return { agents: [], canManage: false };
      }

      let rows = await fetchAgentRoleUsers();

      if (
        canReadManagedUsers(role) &&
        !canManageSettings(role) &&
        !canManageUsers(role)
      ) {
        const managed = await prisma.user.findMany({
          where: {
            createdById: scope.userId,
            role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
          },
          select: { id: true },
        });
        const managedIds = new Set(managed.map((user) => user.id));
        rows = rows.filter((row) => managedIds.has(row.id));
      }

      const auditCountByAgent = await fetchAuditCountsByAgentName();

      return {
        canManage: canManageSettings(role),
        agents: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          hasProfileName: row.hasProfileName,
          dateOfJoining: row.dateOfJoining,
          auditCount: auditCountByAgent.get(row.name) ?? 0,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
    [`agents-management-${key}`],
    {
      tags: [CACHE_TAGS.AGENTS, CACHE_TAGS.userAgents(scope.userId)],
      revalidate: CACHE_TTL.STANDARD,
    }
  );
}
