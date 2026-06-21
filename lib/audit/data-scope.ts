import type { Prisma } from "@prisma/client";
import type { SessionRole } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/rbac";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import { caseInsensitiveIn } from "@/lib/audit/prisma-string-filters";
import {
  fetchAgentUserAuditMatchNames,
  fetchUserAuditMatchNamesById,
} from "@/lib/audit/user-audit-match";

export type DataScopeContext = {
  userId: string;
  userName: string | null | undefined;
  userEmail?: string | null;
  role: SessionRole;
};

export function effectiveScopeName(ctx: DataScopeContext): string | null {
  return resolveRoleUserName({
    name: ctx.userName ?? null,
    email: ctx.userEmail ?? "",
  });
}

const GLOBAL_DATA_ROLES = new Set<SystemRoleSlug>([
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
  SYSTEM_ROLE_SLUGS.ADMIN,
]);

function noAccessFilter(): Prisma.AuditSubmissionWhereInput {
  return { id: "__no_access__" };
}

function orClauses(
  clauses: Prisma.AuditSubmissionWhereInput[]
): Prisma.AuditSubmissionWhereInput {
  const filtered = clauses.filter(Boolean);
  if (filtered.length === 0) return noAccessFilter();
  if (filtered.length === 1) return filtered[0]!;
  return { OR: filtered };
}

/**
 * Row-level filter for audit submissions based on role and managed user hierarchy.
 */
export async function auditSubmissionScopeWhere(
  ctx: DataScopeContext
): Promise<Prisma.AuditSubmissionWhereInput | undefined> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return undefined;
  }

  const roleSlug = ctx.role.slug as SystemRoleSlug;

  if (roleSlug === SYSTEM_ROLE_SLUGS.SUPERVISOR) {
    const agentNames = await fetchAgentRosterNames(
      ctx.userId,
      SYSTEM_ROLE_SLUGS.SUPERVISOR
    );
    const agentFilter = caseInsensitiveIn(agentNames);
    if (!agentFilter) {
      return noAccessFilter();
    }
    return { agent: agentFilter };
  }

  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const agentNames = await fetchAgentRosterNames(
      ctx.userId,
      SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
    );
    const agentFilter = caseInsensitiveIn(agentNames);
    if (!agentFilter) {
      return noAccessFilter();
    }
    return { agent: agentFilter };
  }

  switch (roleSlug) {
    case SYSTEM_ROLE_SLUGS.AGENT: {
      const matchNames = await fetchAgentUserAuditMatchNames(ctx.userId);
      const agentFilter = caseInsensitiveIn(matchNames);
      return orClauses([
        { submittedById: ctx.userId },
        ...(agentFilter ? [{ agent: agentFilter }] : []),
      ]);
    }
    case SYSTEM_ROLE_SLUGS.QUALITY_ANALYST: {
      const [agentNames, auditorNames] = await Promise.all([
        fetchAgentRosterNames(ctx.userId, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST),
        fetchUserAuditMatchNamesById(ctx.userId),
      ]);
      const agentFilter = caseInsensitiveIn(agentNames);
      const auditorFilter = caseInsensitiveIn(auditorNames);
      return orClauses([
        { submittedById: ctx.userId },
        ...(auditorFilter ? [{ auditor: auditorFilter }] : []),
        ...(agentFilter ? [{ agent: agentFilter }] : []),
      ]);
    }
    default:
      return noAccessFilter();
  }
}

export function dataScopeFromSession(session: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: SessionRole;
  };
}): DataScopeContext {
  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    role: session.user.role,
  };
}
