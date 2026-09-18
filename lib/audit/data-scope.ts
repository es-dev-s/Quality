import type { Prisma } from "@prisma/client";
import type { SessionRole } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/rbac";
import {
  fetchQualityAnalystRoleUsers,
  resolveRoleUserName,
} from "@/lib/audit/role-users";
import { fetchAgentRosterNames, fetchQmApprovedAgentDisplayNames } from "@/lib/audit/agent-roster";
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
import {
  fetchApprovedTransferIdsForQa,
  fetchApprovedTransferIdsForQm,
  fetchCreatedSupervisorIds,
  historyAuditsForSupervisors,
  historyAuditsForTransferIds,
} from "@/lib/audit/transfer-history-scope";

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

/** Audits submitted by a Quality Manager. */
function qualityManagerSubmittedClause(): Prisma.AuditSubmissionWhereInput {
  return {
    submittedBy: {
      role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER },
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

/**
 * Hide audits the Quality Manager themselves made.
 * Keep rows attributed to a Quality Analyst (auditor name), including older
 * QA logs that were saved under a QM submitter.
 */
async function excludeQualityManagerSubmitted(
  where: Prisma.AuditSubmissionWhereInput
): Promise<Prisma.AuditSubmissionWhereInput> {
  const qaUsers = await fetchQualityAnalystRoleUsers({ includeInactive: true });
  const qaLabels = qaUsers.flatMap((user) =>
    [user.profileName, user.name, user.email].filter(
      (value): value is string => Boolean(value?.trim())
    )
  );
  const qaAuditor = caseInsensitiveIn(qaLabels);

  return {
    AND: [
      where,
      {
        OR: [
          { NOT: qualityManagerSubmittedClause() },
          ...(qaAuditor ? [{ auditor: qaAuditor }] : []),
        ],
      },
    ],
  };
}

/** Hide audits that have not been released from Pending feedback. */
function excludePendingFeedback(
  where: Prisma.AuditSubmissionWhereInput
): Prisma.AuditSubmissionWhereInput {
  return {
    AND: [where, { NOT: { feedbackStatus: "Pending" } }],
  };
}

/** Agent visibility for a specific user id (used by Agent role and Member grants). */
export async function buildAgentScopeWhere(
  userId: string,
  options?: { includeTransferHistory?: boolean }
): Promise<Prisma.AuditSubmissionWhereInput> {
  const matchNames = await fetchAgentUserAuditMatchNames(userId);
  const agentFilter = caseInsensitiveIn(matchNames);
  const identity = orClauses([
    { submittedById: userId },
    ...(agentFilter ? [{ agent: agentFilter }] : []),
  ]);
  const scoped =
    options?.includeTransferHistory === false
      ? { AND: [identity, { isHistory: false }] }
      : identity;
  return excludePendingFeedback(
    await excludeQualityManagerSubmitted(excludeSupervisorSubmitted(scoped))
  );
}

/** QA visibility for a specific user id (used by QA role and Member grants). */
export async function buildQaScopeWhere(
  userId: string
): Promise<Prisma.AuditSubmissionWhereInput> {
  const [agentNames, auditorNames, historyTransferIds] = await Promise.all([
    fetchAgentRosterNames(userId, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST, {
      includeInactive: true,
    }),
    fetchUserAuditMatchNamesById(userId),
    fetchApprovedTransferIdsForQa(userId),
  ]);
  const agentFilter = caseInsensitiveIn(agentNames);
  const auditorFilter = caseInsensitiveIn(auditorNames);
  const live = excludeSupervisorSubmitted(
    orClauses([
      { submittedById: userId },
      ...(auditorFilter ? [{ auditor: auditorFilter }] : []),
      // Current assignments include deactivated agents still on this QA.
      // After a member transfers, the new QA must not inherit previous history.
      ...(agentFilter ? [{ agent: agentFilter, isHistory: false }] : []),
    ])
  );
  const pastTeamHistory = historyAuditsForTransferIds(historyTransferIds);
  return pastTeamHistory ? orClauses([live, pastTeamHistory]) : live;
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

  // QM: current roster (including deactivated agents still on this QM) is
  // working-only. History is Team 1 data for supervisors this QM created,
  // transfers they reviewed, and agents they approved.
  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const [rosterNames, approvedNames, supervisorIds] = await Promise.all([
      fetchAgentRosterNames(ctx.userId, SYSTEM_ROLE_SLUGS.QUALITY_MANAGER, {
        includeInactive: true,
      }),
      fetchQmApprovedAgentDisplayNames(ctx.userId),
      fetchCreatedSupervisorIds(ctx.userId),
    ]);
    const transferIds = await fetchApprovedTransferIdsForQm(
      ctx.userId,
      supervisorIds
    );
    const rosterFilter = caseInsensitiveIn(rosterNames);
    const approvedFilter = caseInsensitiveIn(approvedNames);
    const supervisorHistory = historyAuditsForSupervisors(supervisorIds);
    const reviewedHistory = historyAuditsForTransferIds(transferIds);
    return orClauses([
      ...(rosterFilter ? [{ agent: rosterFilter, isHistory: false }] : []),
      ...(approvedFilter ? [{ agent: approvedFilter, isHistory: true }] : []),
      ...(supervisorHistory ? [supervisorHistory] : []),
      ...(reviewedHistory ? [reviewedHistory] : []),
    ]);
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
      isHistory: true,
      OR: [
        { historyOwnerId: ctx.userId },
        { historyTransfer: { fromSupervisorId: ctx.userId } },
      ],
    };
    return orClauses([
      { submittedById: ctx.userId },
      ...(teamNonSupervisorClause ? [teamNonSupervisorClause] : []),
      historyClause,
    ]);
  }

  switch (roleSlug) {
    case SYSTEM_ROLE_SLUGS.AGENT:
      return buildAgentScopeWhere(ctx.userId, { includeTransferHistory: false });
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
