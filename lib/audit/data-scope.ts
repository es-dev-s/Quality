import type { Prisma } from "@prisma/client";
import type { SessionRole } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/rbac";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import {
  fetchManagedAgentNames,
  fetchManagedAnalystNames,
} from "@/lib/audit/managed-user-names";

export type DataScopeContext = {
  userId: string;
  userName: string | null | undefined;
  userEmail?: string | null;
  role: SessionRole;
};

function effectiveScopeName(ctx: DataScopeContext): string | null {
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
    const agentNames = await fetchManagedAgentNames(ctx.userId);
    if (agentNames.length === 0) {
      return noAccessFilter();
    }
    return { agent: { in: agentNames } };
  }

  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const analystNames = await fetchManagedAnalystNames(ctx.userId);
    if (analystNames.length === 0) {
      return noAccessFilter();
    }
    return { auditor: { in: analystNames } };
  }

  const name = effectiveScopeName(ctx);
  if (!name) {
    return noAccessFilter();
  }

  switch (roleSlug) {
    case SYSTEM_ROLE_SLUGS.AGENT:
      return { agent: name };
    case SYSTEM_ROLE_SLUGS.QUALITY_ANALYST:
      return { auditor: name };
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
