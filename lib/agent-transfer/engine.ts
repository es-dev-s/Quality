/**
 * Agent transfer + revert engine.
 *
 * Pure database logic (no Next.js cache / SSE / session access) so it can run
 * inside a single interactive transaction and be integration-tested directly.
 * Server actions in lib/actions/agent-transfer.ts own auth, rate limits,
 * cache invalidation, notifications and realtime broadcasts.
 */
import type { AgentTransfer, Prisma } from "@prisma/client";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import {
  buildAgentOwnedAuditWhere,
  tagWorkingAuditsForTransfer,
} from "@/lib/audit/transfer-history";
import { revertWindowEndsAt } from "@/lib/agent-transfer/config";

export const AGENT_TRANSFER_SECURITY_ACTIONS = {
  TRANSFERRED: "AGENT_TRANSFERRED",
  TRANSFER_REVERTED: "AGENT_TRANSFER_REVERTED",
} as const;

export type AgentTransferErrorCode =
  | "ALREADY_REVIEWED"
  | "SUPERVISOR_CHANGED"
  | "PENDING_EXISTS"
  | "NOT_FOUND"
  | "NOT_REVERTIBLE"
  | "ALREADY_REVERTED"
  | "FORBIDDEN"
  | "WINDOW_EXPIRED"
  | "NOT_LATEST"
  | "FROM_SUPERVISOR_INACTIVE"
  | "STALE_VERSION"
  | "DISABLED";

export class AgentTransferError extends Error {
  constructor(
    readonly code: AgentTransferErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AgentTransferError";
  }
}

export type TransferActor = { id: string; roleSlug: string };

type Db = Prisma.TransactionClient;

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Row lock on the agent so transfer / approve / revert serialize per agent. */
export async function lockAgentRow(tx: Db, agentUserId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${agentUserId} FOR UPDATE`;
}

async function lockTransferRow(tx: Db, transferId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "agent_transfers" WHERE id = ${transferId} FOR UPDATE`;
}

async function switchMembership(
  tx: Db,
  params: {
    agentUserId: string;
    supervisorId: string;
    teamName: string | null;
    qaUserId: string | null;
    transferId: string;
    now: Date;
  }
) {
  await tx.agentTeamMembership.updateMany({
    where: { agentUserId: params.agentUserId, endedAt: null },
    data: { endedAt: params.now, endedByTransferId: params.transferId },
  });
  return tx.agentTeamMembership.create({
    data: {
      agentUserId: params.agentUserId,
      supervisorId: params.supervisorId,
      teamNameSnapshot: params.teamName,
      qaUserId: params.qaUserId,
      startedAt: params.now,
      startedByTransferId: params.transferId,
    },
    select: { id: true },
  });
}

export type TransferExecution = {
  taggedCount: number;
  fromQaUserId: string | null;
  fromTeamName: string | null;
  toTeamName: string | null;
};

/**
 * Applies an approved transfer inside the caller's transaction: tags the old
 * team's working audits as history, moves ownership, team name, QA assignment
 * and membership, and writes the security audit log.
 */
export async function executeAgentTransfer(
  tx: Db,
  params: {
    transferId: string;
    agentUserId: string;
    agentDisplayName: string;
    fromSupervisorId: string;
    toSupervisorId: string;
    actorUserId: string;
    now?: Date;
  }
): Promise<TransferExecution> {
  const { transferId, agentUserId, agentDisplayName, fromSupervisorId, toSupervisorId } =
    params;
  const now = params.now ?? new Date();

  await lockAgentRow(tx, agentUserId);

  // Sequential on purpose: queries on one interactive-transaction connection
  // must not be issued concurrently (pg deprecates it).
  const fromSupervisor = await tx.user.findUnique({
    where: { id: fromSupervisorId },
    select: { teamName: true },
  });
  const toSupervisor = await tx.user.findUnique({
    where: { id: toSupervisorId },
    select: { teamName: true },
  });
  const agent = await tx.user.findUnique({
    where: { id: agentUserId },
    select: { teamName: true },
  });
  const assignment = await tx.agentAssignment.findUnique({
    where: { agentId: agentUserId },
    select: { assignedToId: true, assignedById: true },
  });
  const fromTeamName = trimOrNull(fromSupervisor?.teamName);
  const toTeamName = trimOrNull(toSupervisor?.teamName);
  const fromQaUserId = assignment?.assignedToId ?? null;

  const taggedCount = await tagWorkingAuditsForTransfer(tx, {
    transferId,
    agentUserId,
    extraNames: [agentDisplayName],
    fromSupervisorId,
    previousTeamName: fromTeamName,
    excludeSubmittedById: toSupervisorId,
  });

  await tx.agentAssignment.deleteMany({ where: { agentId: agentUserId } });

  const ownershipUpdate = await tx.user.updateMany({
    where: { id: agentUserId, createdById: fromSupervisorId },
    data: {
      createdById: toSupervisorId,
      // Keep the agent's team label in sync with the new supervisor's team.
      ...(toTeamName ? { teamName: toTeamName } : {}),
    },
  });
  if (ownershipUpdate.count === 0) {
    throw new AgentTransferError(
      "SUPERVISOR_CHANGED",
      "Agent supervisor changed before transfer could complete."
    );
  }

  await tx.agentTransfer.update({
    where: { id: transferId },
    data: {
      auditCountAtTransfer: taggedCount,
      status: "APPROVED",
      transferredAt: now,
      fromQaUserId,
      fromQaAssignedById: assignment?.assignedById ?? null,
      fromTeamNameSnapshot: fromTeamName,
      toTeamNameSnapshot: toTeamName,
      // "" marks "no team name" so revert can tell it apart from legacy rows.
      agentTeamNameBefore: agent?.teamName ?? "",
    },
  });

  await switchMembership(tx, {
    agentUserId,
    supervisorId: toSupervisorId,
    teamName: toTeamName,
    qaUserId: null,
    transferId,
    now,
  });

  await tx.securityAuditLog.create({
    data: {
      action: AGENT_TRANSFER_SECURITY_ACTIONS.TRANSFERRED,
      actorUserId: params.actorUserId,
      targetUserId: agentUserId,
      metadata: {
        transferId,
        fromSupervisorId,
        toSupervisorId,
        fromQaUserId,
        fromTeamName,
        toTeamName,
        historyAuditCount: taggedCount,
      },
    },
  });

  return { taggedCount, fromQaUserId, fromTeamName, toTeamName };
}

// ---------------------------------------------------------------------------
// Revert
// ---------------------------------------------------------------------------

export type RevertEligibility =
  | { ok: true; windowEndsAt: Date }
  | { ok: false; code: AgentTransferErrorCode; message: string; windowEndsAt: Date | null };

type RevertContext = {
  transfer: AgentTransfer;
  agent: { id: string; name: string | null; email: string; createdById: string | null; teamName: string | null };
  fromSupervisor: {
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
    approvalStatus: string;
    teamName: string | null;
    createdById: string | null;
  };
  toSupervisor: { id: string; name: string | null; email: string; teamName: string | null };
};

async function loadRevertContext(db: Db, transferId: string): Promise<RevertContext | null> {
  const transfer = await db.agentTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return null;
  // Sequential: may run on an interactive-transaction connection.
  const agent = await db.user.findUnique({
    where: { id: transfer.agentUserId },
    select: { id: true, name: true, email: true, createdById: true, teamName: true },
  });
  const fromSupervisor = await db.user.findUnique({
    where: { id: transfer.fromSupervisorId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      approvalStatus: true,
      teamName: true,
      createdById: true,
    },
  });
  const toSupervisor = await db.user.findUnique({
    where: { id: transfer.toSupervisorId },
    select: { id: true, name: true, email: true, teamName: true },
  });
  if (!agent || !fromSupervisor || !toSupervisor) return null;
  return { transfer, agent, fromSupervisor, toSupervisor };
}

/** QM who owns the from-supervisor (created them), or null. */
export function canActorRevert(actor: TransferActor, ctx: Pick<RevertContext, "fromSupervisor">): boolean {
  if (actor.roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN) return true;
  return (
    actor.roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    ctx.fromSupervisor.createdById === actor.id
  );
}

async function evaluateRevert(
  db: Db,
  ctx: RevertContext,
  params: { actor: TransferActor; now: Date; windowDays: number; expectedVersion?: number | null }
): Promise<RevertEligibility> {
  const { transfer } = ctx;
  const windowEndsAt = transfer.transferredAt
    ? revertWindowEndsAt(transfer.transferredAt, params.windowDays)
    : null;
  const fail = (code: AgentTransferErrorCode, message: string): RevertEligibility => ({
    ok: false,
    code,
    message,
    windowEndsAt,
  });

  if (transfer.status === "REVERTED") {
    return fail("ALREADY_REVERTED", "This transfer has already been reverted.");
  }
  if (transfer.kind !== "TRANSFER" || transfer.status !== "APPROVED" || !transfer.transferredAt || !windowEndsAt) {
    return fail("NOT_REVERTIBLE", "Only completed transfers can be reverted.");
  }
  if (!canActorRevert(params.actor, ctx)) {
    return fail(
      "FORBIDDEN",
      "Only the previous supervisor's quality manager or a super admin can revert this transfer."
    );
  }
  if (params.expectedVersion != null && params.expectedVersion !== transfer.version) {
    return fail("STALE_VERSION", "This transfer changed since you opened it. Refresh and try again.");
  }
  if (params.now.getTime() > windowEndsAt.getTime()) {
    return fail(
      "WINDOW_EXPIRED",
      `The ${params.windowDays}-day revert window for this transfer has closed.`
    );
  }

  const later = await db.agentTransfer.findFirst({
    where: {
      agentUserId: transfer.agentUserId,
      id: { not: transfer.id },
      status: { in: ["APPROVED", "REVERTED"] },
      transferredAt: { gt: transfer.transferredAt },
    },
    select: { id: true },
  });
  const pending = await db.agentTransfer.findFirst({
    where: { agentUserId: transfer.agentUserId, status: "PENDING" },
    select: { id: true },
  });
  if (later) {
    return fail("NOT_LATEST", "Only the agent's most recent transfer can be reverted.");
  }
  if (pending) {
    return fail(
      "PENDING_EXISTS",
      "This agent has a pending transfer request. Resolve it before reverting."
    );
  }
  if (ctx.agent.createdById !== transfer.toSupervisorId) {
    return fail("SUPERVISOR_CHANGED", "The agent is no longer with the receiving supervisor.");
  }
  if (!ctx.fromSupervisor.isActive || ctx.fromSupervisor.approvalStatus !== "ACTIVE") {
    return fail(
      "FROM_SUPERVISOR_INACTIVE",
      "The previous supervisor is inactive, so the agent cannot be returned to them."
    );
  }

  return { ok: true, windowEndsAt };
}

async function buildHeldAuditWhere(
  db: Db,
  ctx: RevertContext
): Promise<Prisma.AuditSubmissionWhereInput> {
  const owned = await buildAgentOwnedAuditWhere(db, {
    agentUserId: ctx.transfer.agentUserId,
    extraNames: [ctx.transfer.agentNameSnapshot],
  });
  const transferredAt = ctx.transfer.transferredAt ?? new Date(0);
  return {
    ...owned,
    AND: [
      ...((owned.AND as Prisma.AuditSubmissionWhereInput[] | undefined) ?? []),
      {
        OR: [
          { ownerSupervisorId: ctx.transfer.toSupervisorId },
          { ownerSupervisorId: null, createdAt: { gte: transferredAt } },
        ],
      },
    ],
  };
}

export type RevertPreview = {
  transferId: string;
  version: number;
  agentName: string;
  fromSupervisorName: string;
  toSupervisorName: string;
  fromTeamName: string | null;
  toTeamName: string | null;
  transferredAt: string | null;
  windowEndsAt: string | null;
  restoreAuditCount: number;
  holdAuditCount: number;
  restoreQaName: string | null;
  restoreQaActive: boolean;
  currentQaName: string | null;
  eligible: boolean;
  blockedCode: AgentTransferErrorCode | null;
  blockedReason: string | null;
};

export async function previewAgentTransferRevert(
  db: Db,
  params: { transferId: string; actor: TransferActor; now?: Date; windowDays: number }
): Promise<RevertPreview | null> {
  const ctx = await loadRevertContext(db, params.transferId);
  if (!ctx) return null;
  const now = params.now ?? new Date();
  const eligibility = await evaluateRevert(db, ctx, {
    actor: params.actor,
    now,
    windowDays: params.windowDays,
  });

  const [restoreAuditCount, holdAuditCount, restoreQa, currentAssignment] = await Promise.all([
    db.auditSubmission.count({
      where: { isHistory: true, historyTransferId: ctx.transfer.id },
    }),
    ctx.transfer.status === "APPROVED"
      ? buildHeldAuditWhere(db, ctx).then((where) => db.auditSubmission.count({ where }))
      : Promise.resolve(0),
    ctx.transfer.fromQaUserId
      ? db.user.findUnique({
          where: { id: ctx.transfer.fromQaUserId },
          select: { name: true, email: true, isActive: true, approvalStatus: true },
        })
      : Promise.resolve(null),
    db.agentAssignment.findUnique({
      where: { agentId: ctx.transfer.agentUserId },
      select: { assignedTo: { select: { name: true, email: true } } },
    }),
  ]);

  return {
    transferId: ctx.transfer.id,
    version: ctx.transfer.version,
    agentName: ctx.transfer.agentNameSnapshot,
    fromSupervisorName: resolveRoleUserName(ctx.fromSupervisor),
    toSupervisorName: resolveRoleUserName(ctx.toSupervisor),
    fromTeamName: ctx.transfer.fromTeamNameSnapshot ?? trimOrNull(ctx.fromSupervisor.teamName),
    toTeamName: ctx.transfer.toTeamNameSnapshot ?? trimOrNull(ctx.toSupervisor.teamName),
    transferredAt: ctx.transfer.transferredAt?.toISOString() ?? null,
    windowEndsAt: eligibility.windowEndsAt?.toISOString() ?? null,
    restoreAuditCount,
    holdAuditCount,
    restoreQaName: restoreQa ? resolveRoleUserName(restoreQa) : null,
    restoreQaActive: Boolean(
      restoreQa?.isActive && restoreQa.approvalStatus === "ACTIVE"
    ),
    currentQaName: currentAssignment
      ? resolveRoleUserName(currentAssignment.assignedTo)
      : null,
    eligible: eligibility.ok,
    blockedCode: eligibility.ok ? null : eligibility.code,
    blockedReason: eligibility.ok ? null : eligibility.message,
  };
}

/** Batch eligibility for the history table (no row locks). */
export async function getRevertEligibilityForTransfers(
  db: Db,
  params: { transferIds: string[]; actor: TransferActor; now?: Date; windowDays: number }
): Promise<Map<string, RevertEligibility>> {
  const result = new Map<string, RevertEligibility>();
  const now = params.now ?? new Date();
  for (const transferId of params.transferIds) {
    const ctx = await loadRevertContext(db, transferId);
    if (!ctx) continue;
    result.set(
      transferId,
      await evaluateRevert(db, ctx, { actor: params.actor, now, windowDays: params.windowDays })
    );
  }
  return result;
}

export type RevertResult = {
  alreadyApplied: boolean;
  transferId: string;
  revertTransferId: string;
  agentUserId: string;
  agentName: string;
  fromSupervisorId: string;
  toSupervisorId: string;
  /** QA on the receiving team at revert time (keeps visibility of held audits). */
  receivingQaUserId: string | null;
  /** QA restored on the original team (null when none or inactive). */
  restoredQaUserId: string | null;
  qaRestoreSkipped: boolean;
  fromSupervisorQmId: string | null;
  restoredAuditCount: number;
  heldAuditCount: number;
};

/**
 * Reverts the agent's latest transfer. Must run inside an interactive
 * transaction. Restores the original team's audits to working, holds the
 * receiving team's audits as history for that team, and returns the agent
 * (ownership, team name, QA, membership) to the original supervisor.
 */
export async function revertAgentTransferInTx(
  tx: Db,
  params: {
    transferId: string;
    actor: TransferActor;
    reason: string;
    windowDays: number;
    idempotencyKey: string;
    expectedVersion?: number | null;
    now?: Date;
  }
): Promise<RevertResult> {
  const now = params.now ?? new Date();

  const existing = await tx.agentTransfer.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });
  if (existing) {
    if (existing.revertOfTransferId !== params.transferId) {
      throw new AgentTransferError("NOT_REVERTIBLE", "Idempotency key was already used for another request.");
    }
    const original = await tx.agentTransfer.findUnique({ where: { id: params.transferId } });
    return {
      alreadyApplied: true,
      transferId: params.transferId,
      revertTransferId: existing.id,
      agentUserId: existing.agentUserId,
      agentName: existing.agentNameSnapshot,
      fromSupervisorId: original?.fromSupervisorId ?? existing.toSupervisorId,
      toSupervisorId: original?.toSupervisorId ?? existing.fromSupervisorId,
      receivingQaUserId: existing.fromQaUserId,
      restoredQaUserId: null,
      qaRestoreSkipped: false,
      fromSupervisorQmId: null,
      restoredAuditCount: 0,
      heldAuditCount: existing.auditCountAtTransfer,
    };
  }

  const head = await tx.agentTransfer.findUnique({
    where: { id: params.transferId },
    select: { agentUserId: true },
  });
  if (!head) throw new AgentTransferError("NOT_FOUND", "Transfer not found.");

  // Lock order: agent row, then transfer row (same order as transfer/approve).
  await lockAgentRow(tx, head.agentUserId);
  await lockTransferRow(tx, params.transferId);

  const ctx = await loadRevertContext(tx, params.transferId);
  if (!ctx) throw new AgentTransferError("NOT_FOUND", "Transfer not found.");

  const eligibility = await evaluateRevert(tx, ctx, {
    actor: params.actor,
    now,
    windowDays: params.windowDays,
    expectedVersion: params.expectedVersion,
  });
  if (!eligibility.ok) {
    throw new AgentTransferError(eligibility.code, eligibility.message);
  }

  const { transfer, fromSupervisor, toSupervisor } = ctx;
  const fromTeamName = trimOrNull(fromSupervisor.teamName) ?? transfer.fromTeamNameSnapshot;
  const toTeamName = transfer.toTeamNameSnapshot ?? trimOrNull(toSupervisor.teamName);

  const currentAssignment = await tx.agentAssignment.findUnique({
    where: { agentId: transfer.agentUserId },
    select: { assignedToId: true, assignedById: true },
  });
  const receivingQaUserId = currentAssignment?.assignedToId ?? null;

  // 1) Ledger row for the revert (status APPROVED so receiving-team history
  //    visibility reuses the existing transfer-history scope).
  const revertRow = await tx.agentTransfer.create({
    data: {
      kind: "REVERT",
      status: "APPROVED",
      agentUserId: transfer.agentUserId,
      agentNameSnapshot: transfer.agentNameSnapshot,
      agentEmailSnapshot: transfer.agentEmailSnapshot,
      fromSupervisorId: transfer.toSupervisorId,
      toSupervisorId: transfer.fromSupervisorId,
      fromQaUserId: receivingQaUserId,
      fromQaAssignedById: currentAssignment?.assignedById ?? null,
      transferredById: params.actor.id,
      assignedReviewerId: params.actor.id,
      reviewedById: params.actor.id,
      reviewedAt: now,
      transferredAt: now,
      requestedAt: now,
      note: params.reason,
      revertOfTransferId: transfer.id,
      idempotencyKey: params.idempotencyKey,
      fromTeamNameSnapshot: toTeamName,
      toTeamNameSnapshot: fromTeamName,
      agentTeamNameBefore: ctx.agent.teamName ?? "",
    },
  });

  // 2) Receiving team's audits stay with the receiving team as history.
  const heldWhere = await buildHeldAuditWhere(tx, ctx);
  if (toTeamName) {
    await tx.auditSubmission.updateMany({
      where: { ...heldWhere, teamNameSnapshot: null },
      data: { teamNameSnapshot: toTeamName },
    });
  }
  const held = await tx.auditSubmission.updateMany({
    where: heldWhere,
    data: {
      isHistory: true,
      historyOwnerId: transfer.toSupervisorId,
      historyTransferId: revertRow.id,
      ownerSupervisorId: transfer.toSupervisorId,
      // Matched unambiguously to this agent, so pin ownership by id.
      agentUserId: transfer.agentUserId,
    },
  });

  // 3) Original team's audits become working (editable, in KPIs) again.
  const restored = await tx.auditSubmission.updateMany({
    where: { isHistory: true, historyTransferId: transfer.id },
    data: {
      isHistory: false,
      historyOwnerId: null,
      historyTransferId: null,
      ownerSupervisorId: transfer.fromSupervisorId,
      // Tagged for this agent at transfer time; legacy name-only rows gain
      // a stable agent id so the membership link below covers them too.
      agentUserId: transfer.agentUserId,
    },
  });

  // 4) Agent ownership + team label back to the original supervisor.
  const restoreTeamName =
    transfer.agentTeamNameBefore !== null
      ? transfer.agentTeamNameBefore || null
      : undefined; // legacy transfer: team name was never changed
  const moved = await tx.user.updateMany({
    where: { id: transfer.agentUserId, createdById: transfer.toSupervisorId },
    data: {
      createdById: transfer.fromSupervisorId,
      ...(restoreTeamName !== undefined ? { teamName: restoreTeamName } : {}),
    },
  });
  if (moved.count === 0) {
    throw new AgentTransferError("SUPERVISOR_CHANGED", "The agent is no longer with the receiving supervisor.");
  }

  // 5) QA assignment: restore the original QA when still active.
  await tx.agentAssignment.deleteMany({ where: { agentId: transfer.agentUserId } });
  let restoredQaUserId: string | null = null;
  let qaRestoreSkipped = false;
  if (transfer.fromQaUserId) {
    const qa = await tx.user.findFirst({
      where: {
        id: transfer.fromQaUserId,
        isActive: true,
        approvalStatus: "ACTIVE",
        role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST },
      },
      select: { id: true },
    });
    if (qa) {
      const assignedBy = transfer.fromQaAssignedById
        ? await tx.user.findUnique({
            where: { id: transfer.fromQaAssignedById },
            select: { id: true },
          })
        : null;
      await tx.agentAssignment.create({
        data: {
          agentId: transfer.agentUserId,
          assignedToId: qa.id,
          assignedById: assignedBy?.id ?? params.actor.id,
        },
      });
      restoredQaUserId = qa.id;
    } else {
      qaRestoreSkipped = true;
    }
  }

  // 6) Membership periods.
  const membership = await switchMembership(tx, {
    agentUserId: transfer.agentUserId,
    supervisorId: transfer.fromSupervisorId,
    teamName: fromTeamName,
    qaUserId: restoredQaUserId,
    transferId: revertRow.id,
    now,
  });
  await tx.auditSubmission.updateMany({
    where: {
      agentUserId: transfer.agentUserId,
      isHistory: false,
      ownerSupervisorId: transfer.fromSupervisorId,
    },
    data: { teamMembershipId: membership.id },
  });

  // 7) Close the original transfer (optimistic version check).
  const closed = await tx.agentTransfer.updateMany({
    where: { id: transfer.id, status: "APPROVED", version: transfer.version },
    data: {
      status: "REVERTED",
      revertedAt: now,
      revertedById: params.actor.id,
      revertReason: params.reason,
      version: { increment: 1 },
    },
  });
  if (closed.count === 0) {
    throw new AgentTransferError("STALE_VERSION", "This transfer changed while reverting. Refresh and try again.");
  }

  await tx.agentTransfer.update({
    where: { id: revertRow.id },
    data: { auditCountAtTransfer: held.count },
  });

  await tx.securityAuditLog.create({
    data: {
      action: AGENT_TRANSFER_SECURITY_ACTIONS.TRANSFER_REVERTED,
      actorUserId: params.actor.id,
      targetUserId: transfer.agentUserId,
      metadata: {
        transferId: transfer.id,
        revertTransferId: revertRow.id,
        reason: params.reason,
        restoredToSupervisorId: transfer.fromSupervisorId,
        revertedFromSupervisorId: transfer.toSupervisorId,
        restoredAuditCount: restored.count,
        heldAuditCount: held.count,
        restoredQaUserId,
        qaRestoreSkipped,
      },
    },
  });

  const fromSupervisorQm = fromSupervisor.createdById
    ? await tx.user.findFirst({
        where: {
          id: fromSupervisor.createdById,
          role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER },
        },
        select: { id: true },
      })
    : null;

  return {
    alreadyApplied: false,
    transferId: transfer.id,
    revertTransferId: revertRow.id,
    agentUserId: transfer.agentUserId,
    agentName: transfer.agentNameSnapshot,
    fromSupervisorId: transfer.fromSupervisorId,
    toSupervisorId: transfer.toSupervisorId,
    receivingQaUserId,
    restoredQaUserId,
    qaRestoreSkipped,
    fromSupervisorQmId: fromSupervisorQm?.id ?? null,
    restoredAuditCount: restored.count,
    heldAuditCount: held.count,
  };
}
