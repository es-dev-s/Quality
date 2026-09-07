import type { Prisma } from "@prisma/client";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { caseInsensitiveIn } from "@/lib/audit/prisma-string-filters";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  isSupervisorTierRole,
  SUPERVISOR_TIER_ROLE_SLUG_FILTER,
} from "@/lib/audit/supervisor-tier";
import {
  invalidateAgentCaches,
  invalidateAuditCaches,
} from "@/lib/invalidate-cache";

type AuditNameDb = Pick<
  Prisma.TransactionClient,
  "user" | "agent" | "auditSubmission"
>;

function uniqueNames(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter(Boolean)
    ),
  ];
}

export async function collectAgentTransferMatchNames(
  db: AuditNameDb,
  agentUserId: string,
  extraNames: string[] = []
): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: agentUserId },
    select: { name: true, email: true },
  });

  const names = new Set(uniqueNames(extraNames));
  if (!user) return [...names];

  const display = resolveRoleUserName(user);
  if (display) names.add(display);
  if (user.name?.trim()) names.add(user.name.trim());
  if (user.email?.trim()) {
    names.add(user.email.trim());
    names.add(user.email.trim().toLowerCase());
  }

  const trimmedName = user.name?.trim();
  if (trimmedName) {
    const { nameKey } = normalizeAgentName(trimmedName);
    const rosterAgents = await db.agent.findMany({
      where: { nameKey },
      select: { name: true },
    });
    for (const row of rosterAgents) {
      if (row.name.trim()) names.add(row.name.trim());
    }
  }

  return [...names];
}

export async function tagWorkingAuditsForTransfer(
  db: AuditNameDb,
  params: {
    transferId: string;
    agentUserId: string;
    extraNames: string[];
    fromSupervisorId: string;
    previousTeamName?: string | null;
    cutoff?: Date | null;
    excludeSubmittedById?: string | null;
  }
): Promise<number> {
  const names = await collectAgentTransferMatchNames(
    db,
    params.agentUserId,
    params.extraNames
  );
  const agentFilter = caseInsensitiveIn(names);
  if (!agentFilter) return 0;

  const cutoff = params.cutoff ?? null;
  const excludeSubmittedById = params.excludeSubmittedById?.trim() || null;
  // Cut off by createdAt only. auditDate is the interaction date and is often
  // backdated on the new team — using it would steal their working audits.
  const workingWhere: Prisma.AuditSubmissionWhereInput = {
    isHistory: false,
    agent: agentFilter,
    ...(cutoff ? { createdAt: { lte: cutoff } } : {}),
    ...(excludeSubmittedById
      ? { NOT: { submittedById: excludeSubmittedById } }
      : {}),
  };

  const previousTeamName = params.previousTeamName?.trim() || null;
  if (previousTeamName) {
    await db.auditSubmission.updateMany({
      where: {
        ...workingWhere,
        teamNameSnapshot: null,
      },
      data: { teamNameSnapshot: previousTeamName },
    });
  }

  const tagged = await db.auditSubmission.updateMany({
    where: workingWhere,
    data: {
      isHistory: true,
      historyOwnerId: params.fromSupervisorId,
      historyTransferId: params.transferId,
    },
  });

  return tagged.count;
}

/** Repair untagged pre-transfer audits so the previous team still sees them. */
export async function reconcileOutgoingTransferHistory(
  fromSupervisorIds: string | string[]
): Promise<number> {
  const supervisorIds = [
    ...new Set(
      (Array.isArray(fromSupervisorIds)
        ? fromSupervisorIds
        : [fromSupervisorIds]
      ).filter(Boolean)
    ),
  ];
  if (supervisorIds.length === 0) return 0;

  const transfers = await prisma.agentTransfer.findMany({
    where: {
      fromSupervisorId: { in: supervisorIds },
      status: "APPROVED",
    },
    select: {
      id: true,
      agentUserId: true,
      agentNameSnapshot: true,
      fromSupervisorId: true,
      toSupervisorId: true,
      transferredAt: true,
      requestedAt: true,
    },
    orderBy: { requestedAt: "desc" },
    take: Math.min(500, Math.max(100, supervisorIds.length * 25)),
  });

  if (transfers.length === 0) return 0;

  const supervisors = await prisma.user.findMany({
    where: { id: { in: supervisorIds } },
    select: { id: true, teamName: true },
  });
  const teamBySupervisor = new Map(
    supervisors.map((row) => [row.id, row.teamName?.trim() || null])
  );

  let tagged = 0;
  for (const transfer of transfers) {
    tagged += await tagWorkingAuditsForTransfer(prisma, {
      transferId: transfer.id,
      agentUserId: transfer.agentUserId,
      extraNames: [transfer.agentNameSnapshot],
      fromSupervisorId: transfer.fromSupervisorId,
      previousTeamName: teamBySupervisor.get(transfer.fromSupervisorId) ?? null,
      cutoff: transfer.transferredAt ?? transfer.requestedAt,
      excludeSubmittedById: transfer.toSupervisorId,
    });
  }

  if (tagged > 0) {
    for (const supervisorId of supervisorIds) {
      invalidateAuditCaches(supervisorId);
    }
    invalidateAgentCaches();
  }

  return tagged;
}

export async function reconcileTransferHistoryForViewer(
  userId: string,
  roleSlug: string
): Promise<number> {
  if (isSupervisorTierRole(roleSlug)) {
    return reconcileOutgoingTransferHistory(userId);
  }

  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const supervisors = await prisma.user.findMany({
      where: {
        createdById: userId,
        role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
      },
      select: { id: true },
    });
    return reconcileOutgoingTransferHistory(supervisors.map((row) => row.id));
  }

  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    const submittedAgents = await prisma.auditSubmission.findMany({
      where: { submittedById: userId },
      select: { agent: true },
      distinct: ["agent"],
    });
    const agentNames = uniqueNames(submittedAgents.map((row) => row.agent));
    const agentNameFilter = caseInsensitiveIn(agentNames);
    const transfers = await prisma.agentTransfer.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { fromQaUserId: userId },
          ...(agentNameFilter ? [{ agentNameSnapshot: agentNameFilter }] : []),
        ],
      },
      select: { fromSupervisorId: true },
      take: 100,
    });
    return reconcileOutgoingTransferHistory([
      ...new Set(transfers.map((row) => row.fromSupervisorId)),
    ]);
  }

  return 0;
}
