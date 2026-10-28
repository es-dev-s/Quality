import type { Prisma } from "@prisma/client";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { caseInsensitiveIn } from "@/lib/audit/prisma-string-filters";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";
import {
  invalidateAgentCaches,
  invalidateAuditCaches,
} from "@/lib/invalidate-cache";
import {
  fetchApprovedTransferIdsForQa,
  fetchApprovedTransferIdsForQm,
  fetchCreatedSupervisorIds,
  fetchFromSupervisorIdsForTransfers,
} from "@/lib/audit/transfer-history-scope";

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

/**
 * True when another agent user shares one of the match names (name/email).
 * Legacy audits (no agentUserId) for an ambiguous name are never guessed.
 */
export async function isAgentNameAmbiguous(
  db: Pick<Prisma.TransactionClient, "user">,
  agentUserId: string,
  names: string[]
): Promise<boolean> {
  const filter = caseInsensitiveIn(names);
  if (!filter) return false;
  const other = await db.user.findFirst({
    where: {
      id: { not: agentUserId },
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
      OR: [{ name: filter }, { email: filter }],
    },
    select: { id: true },
  });
  return Boolean(other);
}

/**
 * Working (non-history) audits that belong to an agent while owned by a
 * supervisor. Uses stable ownership (agentUserId / ownerSupervisorId) and only
 * falls back to name matching for legacy rows when the name is unambiguous.
 */
export async function buildAgentOwnedAuditWhere(
  db: AuditNameDb,
  params: {
    agentUserId: string;
    extraNames: string[];
    ownerSupervisorId?: string | null;
  }
): Promise<Prisma.AuditSubmissionWhereInput> {
  const names = await collectAgentTransferMatchNames(
    db,
    params.agentUserId,
    params.extraNames
  );
  const agentFilter = caseInsensitiveIn(names);
  const ambiguous = agentFilter
    ? await isAgentNameAmbiguous(db, params.agentUserId, names)
    : true;

  const agentMatch: Prisma.AuditSubmissionWhereInput[] = [
    { agentUserId: params.agentUserId },
  ];
  if (agentFilter && !ambiguous) {
    agentMatch.push({ agentUserId: null, agent: agentFilter });
  }

  const and: Prisma.AuditSubmissionWhereInput[] = [{ OR: agentMatch }];
  if (params.ownerSupervisorId) {
    and.push({
      OR: [
        { ownerSupervisorId: params.ownerSupervisorId },
        { ownerSupervisorId: null },
      ],
    });
  }

  return { isHistory: false, AND: and };
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
  const ownedWhere = await buildAgentOwnedAuditWhere(db, {
    agentUserId: params.agentUserId,
    extraNames: params.extraNames,
    ownerSupervisorId: params.fromSupervisorId,
  });

  const cutoff = params.cutoff ?? null;
  const excludeSubmittedById = params.excludeSubmittedById?.trim() || null;
  // Cut off by createdAt only. auditDate is the interaction date and is often
  // backdated on the new team — using it would steal their working audits.
  const workingWhere: Prisma.AuditSubmissionWhereInput = {
    ...ownedWhere,
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
      ownerSupervisorId: params.fromSupervisorId,
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
      // REVERT rows tag their own audits at revert time; reconciling them on
      // read would re-steal the restored team's audits.
      kind: "TRANSFER",
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
  try {
    if (isSupervisorTierRole(roleSlug)) {
      return await reconcileOutgoingTransferHistory(userId);
    }

    if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
      const supervisorIds = await fetchCreatedSupervisorIds(userId);
      const transferIds = await fetchApprovedTransferIdsForQm(
        userId,
        supervisorIds
      );
      const transferSupervisors =
        await fetchFromSupervisorIdsForTransfers(transferIds);
      return await reconcileOutgoingTransferHistory([
        ...supervisorIds,
        ...transferSupervisors,
      ]);
    }

    if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
      const [submittedAgents, qaTransferIds] = await Promise.all([
        prisma.auditSubmission.findMany({
          where: { submittedById: userId },
          select: { agent: true },
          distinct: ["agent"],
        }),
        fetchApprovedTransferIdsForQa(userId),
      ]);
      const agentNames = uniqueNames(submittedAgents.map((row) => row.agent));
      const agentNameFilter = caseInsensitiveIn(agentNames);
      const namedTransfers = await prisma.agentTransfer.findMany({
        where: {
          status: "APPROVED",
          ...(agentNameFilter
            ? { agentNameSnapshot: agentNameFilter }
            : { id: "__none__" }),
        },
        select: { fromSupervisorId: true },
        take: 100,
      });
      const qaTransferSupervisors =
        await fetchFromSupervisorIdsForTransfers(qaTransferIds);
      return await reconcileOutgoingTransferHistory([
        ...namedTransfers.map((row) => row.fromSupervisorId),
        ...qaTransferSupervisors,
      ]);
    }

    if (roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN) {
      const transfers = await prisma.agentTransfer.findMany({
        where: { status: "APPROVED" },
        select: { fromSupervisorId: true },
        take: 500,
      });
      return await reconcileOutgoingTransferHistory(
        transfers.map((row) => row.fromSupervisorId)
      );
    }

    return 0;
  } catch (error) {
    console.error("Transfer history reconcile failed:", error);
    return 0;
  }
}
