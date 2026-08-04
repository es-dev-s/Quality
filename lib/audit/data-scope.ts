import type { Prisma } from "@prisma/client";
import type { SessionRole } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/rbac";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import {
  isSupervisorTierRole,
  SUPERVISOR_TIER_ROLE_SLUG_FILTER,
} from "@/lib/audit/supervisor-tier";
import { caseInsensitiveIn } from "@/lib/audit/prisma-string-filters";
import {
  fetchAgentUserAuditMatchNames,
  fetchUserAuditMatchNamesById,
} from "@/lib/audit/user-audit-match";
import { fetchMemberGrantedTargetUserIds } from "@/lib/audit/member-access";

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

/** Audits submitted by Supervisor / Training Supervisor roles. */
function supervisorSubmittedClause(): Prisma.AuditSubmissionWhereInput {
  return {
    submittedBy: {
      role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
    },
  };
}

/**
 * Hide supervisor-submitted audits from roles that should not see them.
 * Only Quality Manager (roster-scoped) and Superadmin may view those rows.
 */
function excludeSupervisorSubmitted(
  where: Prisma.AuditSubmissionWhereInput
): Prisma.AuditSubmissionWhereInput {
  return {
    AND: [where, { NOT: supervisorSubmittedClause() }],
  };
}

/** Agent visibility for a specific user id (used by Agent role and Member grants). */
export async function buildAgentScopeWhere(
  userId: string
): Promise<Prisma.AuditSubmissionWhereInput> {
  const matchNames = await fetchAgentUserAuditMatchNames(userId);
  const agentFilter = caseInsensitiveIn(matchNames);
  return excludeSupervisorSubmitted(
    orClauses([
      { submittedById: userId },
      ...(agentFilter ? [{ agent: agentFilter }] : []),
    ])
  );
}

/** QA visibility for a specific user id (used by QA role and Member grants). */
export async function buildQaScopeWhere(
  userId: string
): Promise<Prisma.AuditSubmissionWhereInput> {
  const [agentNames, auditorNames] = await Promise.all([
    fetchAgentRosterNames(userId, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST),
    fetchUserAuditMatchNamesById(userId),
  ]);
  const agentFilter = caseInsensitiveIn(agentNames);
  const auditorFilter = caseInsensitiveIn(auditorNames);
  return excludeSupervisorSubmitted(
    orClauses([
      { submittedById: userId },
      ...(auditorFilter ? [{ auditor: auditorFilter }] : []),
      ...(agentFilter ? [{ agent: agentFilter }] : []),
    ])
  );
}

async function buildMemberScopeWhere(
  memberUserId: string
): Promise<Prisma.AuditSubmissionWhereInput> {
  const { agentIds, qaIds } =
    await fetchMemberGrantedTargetUserIds(memberUserId);

  if (agentIds.length === 0 && qaIds.length === 0) {
    return noAccessFilter();
  }

  const clauses = await Promise.all([
    ...agentIds.map((id) => buildAgentScopeWhere(id)),
    ...qaIds.map((id) => buildQaScopeWhere(id)),
  ]);

  return orClauses(clauses);
}

/**
 * Row-level filter for audit submissions based on role and managed user hierarchy.
 *
 * Supervisor / Training Supervisor form audits are visible to:
 * - Superadmin (all)
 * - Quality Manager (agents on that QM's roster)
 * - The same supervisor who submitted the audit (own submissions only)
 */
export async function auditSubmissionScopeWhere(
  ctx: DataScopeContext
): Promise<Prisma.AuditSubmissionWhereInput | undefined> {
  if (isSuperAdmin(ctx.role)) {
    return undefined;
  }

  const roleSlug = ctx.role.slug as SystemRoleSlug;

  // Admin sees everything except supervisor-submitted audits.
  if (roleSlug === SYSTEM_ROLE_SLUGS.ADMIN) {
    return { NOT: supervisorSubmittedClause() };
  }

  // QM: respective roster — includes supervisor audits for those agents only.
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

  if (isSupervisorTierRole(roleSlug)) {
    const agentNames = await fetchAgentRosterNames(ctx.userId, roleSlug);
    const agentFilter = caseInsensitiveIn(agentNames);
    // Own submissions are always visible to the auditing supervisor.
    // Other supervisors' form audits stay hidden (QM / Superadmin only).
    const teamNonSupervisorClause: Prisma.AuditSubmissionWhereInput | null =
      agentFilter
        ? {
            AND: [
              { agent: agentFilter, isHistory: false },
              { NOT: supervisorSubmittedClause() },
            ],
          }
        : null;
    const historyClause: Prisma.AuditSubmissionWhereInput = {
      historyOwnerId: ctx.userId,
      isHistory: true,
    };
    return orClauses([
      { submittedById: ctx.userId },
      ...(teamNonSupervisorClause ? [teamNonSupervisorClause] : []),
      historyClause,
    ]);
  }

  switch (roleSlug) {
    case SYSTEM_ROLE_SLUGS.AGENT:
      return buildAgentScopeWhere(ctx.userId);
    case SYSTEM_ROLE_SLUGS.QUALITY_ANALYST:
      return buildQaScopeWhere(ctx.userId);
    case SYSTEM_ROLE_SLUGS.MEMBER:
      return buildMemberScopeWhere(ctx.userId);
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
