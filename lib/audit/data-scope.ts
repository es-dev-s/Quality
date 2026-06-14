import type { Prisma } from "@prisma/client";
import type { SessionRole } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/rbac";

export type DataScopeContext = {
  userId: string;
  userName: string | null | undefined;
  role: SessionRole;
};

const GLOBAL_DATA_ROLES = new Set<SystemRoleSlug>([
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
]);

/**
 * Row-level filter for audit submissions based on predefined role data visibility.
 * User.name must match audit.agent, audit.supervisor, or audit.auditor where applicable.
 */
export function auditSubmissionScopeWhere(
  ctx: DataScopeContext
): Prisma.AuditSubmissionWhereInput | undefined {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return undefined;
  }

  const name = ctx.userName?.trim();
  if (!name) {
    return { id: "__no_access__" };
  }

  switch (ctx.role.slug as SystemRoleSlug) {
    case SYSTEM_ROLE_SLUGS.AGENT:
      return { agent: name };
    case SYSTEM_ROLE_SLUGS.SUPERVISOR:
      return {
        OR: [{ supervisor: name }, { agent: name }],
      };
    case SYSTEM_ROLE_SLUGS.QUALITY_ANALYST:
      return { auditor: name };
    default:
      return { id: "__no_access__" };
  }
}

export function dataScopeFromSession(session: {
  user: { id: string; name?: string | null; role: SessionRole };
}): DataScopeContext {
  return {
    userId: session.user.id,
    userName: session.user.name,
    role: session.user.role,
  };
}
