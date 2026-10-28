"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AgentTransferStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { permissionError, requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { canApproveAgentRequests, isSuperAdmin, type SessionRole } from "@/lib/rbac";
import { assertActorManagesUser } from "@/lib/user-roster-scope";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { caseInsensitiveIn } from "@/lib/audit/prisma-string-filters";
import { assertWriteRateLimit } from "@/lib/server/rate-limit";
import {
  invalidateAgentAssignmentCaches,
  invalidateAgentCaches,
  invalidateAuditCaches,
  invalidateInteractionConfigCaches,
  invalidateUserCaches,
} from "@/lib/invalidate-cache";
import { isSupervisorTierRole, SUPERVISOR_TIER_ROLE_SLUG_FILTER } from "@/lib/audit/supervisor-tier";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { withActiveUserFilter, ACTIVE_USER_WHERE } from "@/lib/user-active-filter";
import {
  buildAgentOwnedAuditWhere,
  reconcileTransferHistoryForViewer,
} from "@/lib/audit/transfer-history";
import {
  fetchApprovedTransferIdsForQa,
  fetchCreatedSupervisorIds,
} from "@/lib/audit/transfer-history-scope";
import { fetchQmApprovedAgentDisplayNames } from "@/lib/audit/agent-roster";
import {
  AgentTransferError as TransferExecutionError,
  executeAgentTransfer,
  getRevertEligibilityForTransfers,
  previewAgentTransferRevert,
  revertAgentTransferInTx,
  type RevertPreview,
} from "@/lib/agent-transfer/engine";
import {
  getAgentTransferRevertWindowDays,
  isAgentTransferRevertEnabled,
} from "@/lib/agent-transfer/config";
import {
  emitAgentTransferRevertedEvents,
  emitAgentTransferredEvents,
} from "@/lib/agent-transfer/events";

const transferSchema = z.object({
  agentUserId: z.string().min(1),
  toSupervisorId: z.string().min(1),
  note: z.string().trim().max(2000).optional(),
});

const reviewSchema = z.object({
  transferId: z.string().min(1),
  reviewNote: z.string().trim().max(2000).optional(),
});

const revertSchema = z.object({
  transferId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(5, "Please give a reason (at least 5 characters).")
    .max(2000),
  idempotencyKey: z.string().trim().min(8).max(100),
  expectedVersion: z.number().int().min(0).optional(),
});

export type TransferTargetSupervisor = {
  id: string;
  name: string;
  email: string;
  teamName: string | null;
};

export type AgentTransferRow = {
  id: string;
  kind: "TRANSFER" | "REVERT";
  version: number;
  revertOfTransferId: string | null;
  revertedAt: string | null;
  revertedByName: string | null;
  revertReason: string | null;
  /** True when the viewer may revert this transfer right now. */
  canRevert: boolean;
  /** Why revert is unavailable (only for viewers who could otherwise revert). */
  revertBlockedReason: string | null;
  revertWindowEndsAt: string | null;
  agentName: string;
  agentEmail: string;
  fromSupervisorName: string;
  toSupervisorName: string;
  transferredByName: string;
  note: string | null;
  auditCountAtTransfer: number;
  status: AgentTransferStatus;
  requestedAt: string;
  transferredAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type PendingAgentTransferRow = {
  id: string;
  agentName: string;
  agentEmail: string;
  fromSupervisorName: string;
  toSupervisorName: string;
  requestedByName: string;
  note: string | null;
  requestedAt: string;
  pendingAuditCount: number;
};

export type TransferHistoryAuditRow = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  transferId: string;
  transferredAt: string;
};

function revalidateTransferPaths(userIds: Array<string | null | undefined>) {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");
  revalidatePath("/audit-transfer-history");
  invalidateInteractionConfigCaches();
  for (const userId of [...new Set(userIds.filter((id): id is string => Boolean(id)))]) {
    invalidateAuditCaches(userId);
    invalidateUserCaches(userId);
  }
  invalidateAgentCaches();
}

function canPerformTransfer(roleSlug: string): boolean {
  return (
    isSupervisorTierRole(roleSlug) ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN
  );
}

function canAutoApproveTransfer(roleSlug: string): boolean {
  return (
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN
  );
}

async function resolveRespectiveQmId(fromSupervisorId: string): Promise<string | null> {
  const supervisor = await prisma.user.findUnique({
    where: { id: fromSupervisorId },
    select: {
      createdById: true,
      createdBy: { select: { role: { select: { slug: true } } } },
    },
  });

  if (
    supervisor?.createdById &&
    supervisor.createdBy?.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  ) {
    return supervisor.createdById;
  }

  return null;
}

async function countWorkingAuditsForAgent(
  agentUserId: string,
  fallbackName: string
): Promise<number> {
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: { createdById: true },
  });
  const where = await buildAgentOwnedAuditWhere(prisma, {
    agentUserId,
    extraNames: [fallbackName],
    ownerSupervisorId: agent?.createdById ?? null,
  });
  return prisma.auditSubmission.count({ where });
}

function supervisorLabel(user: {
  name: string | null;
  email: string;
  teamName?: string | null;
}): string {
  const name = resolveRoleUserName(user);
  const team = user.teamName?.trim();
  return team ? `${team} (${name})` : name;
}

async function notifyTransferCompleted(params: {
  transferId: string;
  agentUserId: string;
  agentName: string;
  fromSupervisorId: string;
  toSupervisorId: string;
  fromQaUserId: string | null;
  actorUserId: string;
}) {
  try {
    const [from, to, fromQmId, toQmId] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.fromSupervisorId },
        select: { name: true, email: true, teamName: true },
      }),
      prisma.user.findUnique({
        where: { id: params.toSupervisorId },
        select: { name: true, email: true, teamName: true },
      }),
      resolveRespectiveQmId(params.fromSupervisorId),
      resolveRespectiveQmId(params.toSupervisorId),
    ]);
    await emitAgentTransferredEvents({
      transferId: params.transferId,
      agentUserId: params.agentUserId,
      agentName: params.agentName,
      fromSupervisorId: params.fromSupervisorId,
      toSupervisorId: params.toSupervisorId,
      qaUserIds: [params.fromQaUserId],
      qmUserIds: [fromQmId, toQmId],
      actorUserId: params.actorUserId,
      fromLabel: from ? supervisorLabel(from) : "the previous team",
      toLabel: to ? supervisorLabel(to) : "the new team",
    });
  } catch (error) {
    console.error("Agent transfer notifications failed:", error);
  }
}

function canReviewTransfer(
  sessionUserId: string,
  role: SessionRole,
  assignedReviewerId: string | null
): boolean {
  if (isSuperAdmin(role)) {
    return true;
  }
  if (role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    return false;
  }
  if (!canApproveAgentRequests(role)) {
    return false;
  }
  if (!assignedReviewerId) {
    return true;
  }
  return assignedReviewerId === sessionUserId;
}

export async function listTransferTargetSupervisors(
  excludeSupervisorId?: string,
  options?: { agentUserId?: string }
): Promise<{ supervisors: TransferTargetSupervisor[] } | { error: string }> {
  await requirePermission(PERMISSIONS.USERS_MANAGE_MANAGED);
  const session = await requireAuth();

  if (!canPerformTransfer(session.user.role.slug)) {
    return { error: "You do not have permission to transfer agents." };
  }

  const excludeIds = new Set<string>();
  if (excludeSupervisorId) {
    excludeIds.add(excludeSupervisorId);
  }
  if (isSupervisorTierRole(session.user.role.slug)) {
    excludeIds.add(session.user.id);
  }
  if (options?.agentUserId) {
    // Never offer the agent's current supervisor as a target.
    const agent = await prisma.user.findUnique({
      where: { id: options.agentUserId },
      select: { createdById: true },
    });
    if (agent?.createdById) excludeIds.add(agent.createdById);
  }

  const supervisors = await prisma.user.findMany({
    where: withActiveUserFilter({
      role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
      ...(excludeIds.size > 0 ? { id: { notIn: [...excludeIds] } } : {}),
    }),
    select: {
      id: true,
      name: true,
      email: true,
      teamName: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return {
    supervisors: supervisors.map((user) => ({
      id: user.id,
      name: resolveRoleUserName(user),
      email: user.email,
      teamName: user.teamName,
    })),
  };
}

export async function transferAgentToSupervisor(input: {
  agentUserId: string;
  toSupervisorId: string;
  note?: string;
}) {
  await requirePermission(PERMISSIONS.USERS_MANAGE_MANAGED);
  const session = await requireAuth();

  if (!canPerformTransfer(session.user.role.slug)) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "agent:transfer",
    { limit: 20, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer request." };
  }

  const manageError = await assertActorManagesUser(
    session.user.id,
    session.user.role,
    parsed.data.agentUserId
  );
  if (manageError && !isSuperAdmin(session.user.role)) {
    if (session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
      return { error: manageError };
    }
  }

  const existingPending = await prisma.agentTransfer.findFirst({
    where: {
      agentUserId: parsed.data.agentUserId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existingPending) {
    return {
      error:
        "This agent already has a pending transfer awaiting quality manager approval.",
    };
  }

  const [agentUser, targetSupervisor] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: parsed.data.agentUserId,
        role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
        ...ACTIVE_USER_WHERE,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdById: true,
      },
    }),
    prisma.user.findFirst({
      where: withActiveUserFilter({
        id: parsed.data.toSupervisorId,
        role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
      }),
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!agentUser) {
    return { error: "Agent not found or inactive." };
  }
  if (!targetSupervisor) {
    return { error: "Target supervisor not found or inactive." };
  }

  const fromSupervisorId = agentUser.createdById;
  if (!fromSupervisorId) {
    return { error: "This agent has no assigned supervisor to transfer from." };
  }
  if (fromSupervisorId === targetSupervisor.id) {
    return { error: "Agent is already assigned to this supervisor." };
  }

  if (isSupervisorTierRole(session.user.role.slug)) {
    if (session.user.id !== fromSupervisorId) {
      return { error: "You can only transfer agents you manage." };
    }
  }

  const agentDisplayName = resolveRoleUserName(agentUser);
  const autoApprove = canAutoApproveTransfer(session.user.role.slug);
  const assignedReviewerId = autoApprove
    ? null
    : await resolveRespectiveQmId(fromSupervisorId);

  if (autoApprove) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const pending = await tx.agentTransfer.findFirst({
          where: { agentUserId: agentUser.id, status: "PENDING" },
          select: { id: true },
        });
        if (pending) {
          throw new TransferExecutionError(
            "PENDING_EXISTS",
            "A pending transfer already exists for this agent."
          );
        }

        const currentAgent = await tx.user.findUnique({
          where: { id: agentUser.id },
          select: { createdById: true },
        });
        if (currentAgent?.createdById !== fromSupervisorId) {
          throw new TransferExecutionError(
            "SUPERVISOR_CHANGED",
            "Agent supervisor changed before transfer could complete."
          );
        }

        const transfer = await tx.agentTransfer.create({
          data: {
            agentUserId: agentUser.id,
            agentNameSnapshot: agentDisplayName,
            agentEmailSnapshot: agentUser.email,
            fromSupervisorId,
            toSupervisorId: targetSupervisor.id,
            transferredById: session.user.id,
            assignedReviewerId: session.user.id,
            status: "PENDING",
            note: parsed.data.note?.trim() || null,
            reviewedById: session.user.id,
            reviewedAt: new Date(),
          },
        });

        const execution = await executeAgentTransfer(tx, {
          transferId: transfer.id,
          agentUserId: agentUser.id,
          agentDisplayName,
          fromSupervisorId,
          toSupervisorId: targetSupervisor.id,
          actorUserId: session.user.id,
        });

        return {
          transferId: transfer.id,
          auditCount: execution.taggedCount,
          fromQaUserId: execution.fromQaUserId,
        };
      });

      invalidateAgentAssignmentCaches(
        session.user.id,
        targetSupervisor.id,
        undefined,
        result.fromQaUserId ? [result.fromQaUserId] : []
      );
      revalidateTransferPaths([
        session.user.id,
        fromSupervisorId,
        targetSupervisor.id,
        result.fromQaUserId,
        agentUser.id,
      ]);
      await notifyTransferCompleted({
        transferId: result.transferId,
        agentUserId: agentUser.id,
        agentName: agentDisplayName,
        fromSupervisorId,
        toSupervisorId: targetSupervisor.id,
        fromQaUserId: result.fromQaUserId,
        actorUserId: session.user.id,
      });

      return {
        success: true as const,
        pending: false as const,
        transferId: result.transferId,
        auditCount: result.auditCount,
        message: `Agent transferred. ${result.auditCount} audit(s) marked as history for the previous supervisor.`,
      };
    } catch (error) {
      if (error instanceof TransferExecutionError) {
        return { error: error.message };
      }
      if (isPrismaUniqueViolation(error)) {
        return {
          error:
            "This agent already has a pending transfer awaiting quality manager approval.",
        };
      }
      throw error;
    }
  }

  const pendingAuditCount = await countWorkingAuditsForAgent(
    agentUser.id,
    agentDisplayName
  );

  try {
    const transfer = await prisma.$transaction(async (tx) => {
      const pending = await tx.agentTransfer.findFirst({
        where: { agentUserId: agentUser.id, status: "PENDING" },
        select: { id: true },
      });
      if (pending) {
        throw new TransferExecutionError(
          "PENDING_EXISTS",
          "This agent already has a pending transfer awaiting quality manager approval."
        );
      }

      const currentAgent = await tx.user.findUnique({
        where: { id: agentUser.id },
        select: { createdById: true },
      });
      if (currentAgent?.createdById !== fromSupervisorId) {
        throw new TransferExecutionError(
          "SUPERVISOR_CHANGED",
          "This agent's supervisor changed before the transfer request could be submitted."
        );
      }

      return tx.agentTransfer.create({
        data: {
          agentUserId: agentUser.id,
          agentNameSnapshot: agentDisplayName,
          agentEmailSnapshot: agentUser.email,
          fromSupervisorId,
          toSupervisorId: targetSupervisor.id,
          transferredById: session.user.id,
          assignedReviewerId,
          status: "PENDING",
          note: parsed.data.note?.trim() || null,
        },
      });
    });

    revalidateTransferPaths([session.user.id, fromSupervisorId, targetSupervisor.id]);

    return {
      success: true as const,
      pending: true as const,
      transferId: transfer.id,
      auditCount: pendingAuditCount,
      message: `Transfer request submitted for quality manager approval. ${pendingAuditCount} audit(s) will be marked as history once approved.`,
    };
  } catch (error) {
    if (error instanceof TransferExecutionError) {
      return { error: error.message };
    }
    if (isPrismaUniqueViolation(error)) {
      return {
        error:
          "This agent already has a pending transfer awaiting quality manager approval.",
      };
    }
    throw error;
  }
}

export async function approveAgentTransferRequest(input: {
  transferId: string;
  reviewNote?: string;
}) {
  await requirePermission(PERMISSIONS.USERS_APPROVE_AGENT);
  const session = await requireAuth();

  if (
    session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    !isSuperAdmin(session.user.role)
  ) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "agent:transfer-approve",
    { limit: 30, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid approval request." };
  }

  const transfer = await prisma.agentTransfer.findUnique({
    where: { id: parsed.data.transferId },
    include: {
      agentUser: { select: { id: true, name: true, email: true, createdById: true } },
    },
  });

  if (!transfer || transfer.status !== "PENDING") {
    return { error: "Transfer request not found or already reviewed." };
  }

  if (
    !canReviewTransfer(
      session.user.id,
      session.user.role,
      transfer.assignedReviewerId
    )
  ) {
    return { error: "You are not assigned to review this transfer request." };
  }

  const autoRejectNote =
    parsed.data.reviewNote?.trim() ||
    "Rejected automatically: agent supervisor changed since request was submitted.";
  const supervisorChangedMessage =
    "This agent's supervisor changed since the request was submitted, so the request was rejected. Submit a new transfer if still needed.";

  if (transfer.agentUser.createdById !== transfer.fromSupervisorId) {
    // Close the stale request so it does not stay PENDING forever.
    await prisma.agentTransfer.updateMany({
      where: { id: transfer.id, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: autoRejectNote,
      },
    });
    revalidateTransferPaths([
      session.user.id,
      transfer.fromSupervisorId,
      transfer.toSupervisorId,
      transfer.transferredById,
    ]);
    return { error: supervisorChangedMessage };
  }

  const agentDisplayName = resolveRoleUserName(transfer.agentUser);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const claimed = await tx.agentTransfer.updateMany({
        where: { id: transfer.id, status: "PENDING" },
        data: {
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reviewNote?.trim() || null,
        },
      });
      if (claimed.count === 0) {
        throw new TransferExecutionError(
          "ALREADY_REVIEWED",
          "Transfer request not found or already reviewed."
        );
      }

      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${transfer.agentUserId} FOR UPDATE`;
      const currentAgent = await tx.user.findUnique({
        where: { id: transfer.agentUserId },
        select: { createdById: true },
      });
      if (currentAgent?.createdById !== transfer.fromSupervisorId) {
        // Return (not throw) so the auto-reject commits instead of rolling back.
        await tx.agentTransfer.update({
          where: { id: transfer.id },
          data: { status: "REJECTED", reviewNote: autoRejectNote },
        });
        return { kind: "auto_rejected" as const };
      }

      const execution = await executeAgentTransfer(tx, {
        transferId: transfer.id,
        agentUserId: transfer.agentUserId,
        agentDisplayName,
        fromSupervisorId: transfer.fromSupervisorId,
        toSupervisorId: transfer.toSupervisorId,
        actorUserId: session.user.id,
      });
      return { kind: "approved" as const, execution };
    });

    if (outcome.kind === "auto_rejected") {
      revalidateTransferPaths([
        session.user.id,
        transfer.fromSupervisorId,
        transfer.toSupervisorId,
        transfer.transferredById,
      ]);
      return { error: supervisorChangedMessage };
    }

    const { execution } = outcome;
    invalidateAgentAssignmentCaches(
      transfer.fromSupervisorId,
      transfer.toSupervisorId,
      undefined,
      execution.fromQaUserId ? [execution.fromQaUserId] : []
    );
    revalidateTransferPaths([
      session.user.id,
      transfer.fromSupervisorId,
      transfer.toSupervisorId,
      transfer.transferredById,
      execution.fromQaUserId,
      transfer.agentUserId,
    ]);
    await notifyTransferCompleted({
      transferId: transfer.id,
      agentUserId: transfer.agentUserId,
      agentName: agentDisplayName,
      fromSupervisorId: transfer.fromSupervisorId,
      toSupervisorId: transfer.toSupervisorId,
      fromQaUserId: execution.fromQaUserId,
      actorUserId: session.user.id,
    });

    return {
      success: true as const,
      message: `Transfer approved. ${execution.taggedCount} audit(s) marked as history for the previous supervisor.`,
    };
  } catch (error) {
    if (error instanceof TransferExecutionError) {
      if (error.code === "SUPERVISOR_CHANGED") {
        revalidateTransferPaths([
          session.user.id,
          transfer.fromSupervisorId,
          transfer.toSupervisorId,
          transfer.transferredById,
        ]);
      }
      return { error: error.message };
    }
    throw error;
  }
}

export async function rejectAgentTransferRequest(input: {
  transferId: string;
  reviewNote?: string;
}) {
  await requirePermission(PERMISSIONS.USERS_APPROVE_AGENT);
  const session = await requireAuth();

  if (
    session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    !isSuperAdmin(session.user.role)
  ) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "agent:transfer-reject",
    { limit: 30, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rejection request." };
  }

  const transfer = await prisma.agentTransfer.findUnique({
    where: { id: parsed.data.transferId },
    select: {
      id: true,
      status: true,
      assignedReviewerId: true,
      fromSupervisorId: true,
      toSupervisorId: true,
      transferredById: true,
    },
  });

  if (!transfer || transfer.status !== "PENDING") {
    return { error: "Transfer request not found or already reviewed." };
  }

  if (
    !canReviewTransfer(
      session.user.id,
      session.user.role,
      transfer.assignedReviewerId
    )
  ) {
    return { error: "You are not assigned to review this transfer request." };
  }

  const rejected = await prisma.agentTransfer.updateMany({
    where: { id: transfer.id, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote?.trim() || null,
    },
  });

  if (rejected.count === 0) {
    return { error: "Transfer request not found or already reviewed." };
  }

  revalidateTransferPaths([
    session.user.id,
    transfer.fromSupervisorId,
    transfer.toSupervisorId,
    transfer.transferredById,
  ]);

  return {
    success: true as const,
    message: "Transfer request rejected.",
  };
}

export async function getPendingAgentTransfersForApproval(): Promise<
  PendingAgentTransferRow[]
> {
  const session = await requireAuth();

  const canApprove =
    canApproveAgentRequests(session.user.role) &&
    (session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
      isSuperAdmin(session.user.role));

  if (!canApprove) {
    return [];
  }

  const where: Prisma.AgentTransferWhereInput = {
    status: "PENDING",
    ...(isSuperAdmin(session.user.role)
      ? {}
      : {
          OR: [
            { assignedReviewerId: session.user.id },
            { assignedReviewerId: null },
          ],
        }),
  };

  const rows = await prisma.agentTransfer.findMany({
    where,
    include: {
      fromSupervisor: { select: { name: true, email: true } },
      toSupervisor: { select: { name: true, email: true } },
      transferredBy: { select: { name: true, email: true } },
    },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });

  const counts = await Promise.all(
    rows.map((row) =>
      countWorkingAuditsForAgent(row.agentUserId, row.agentNameSnapshot)
    )
  );

  return rows.map((row, index) => ({
    id: row.id,
    agentName: row.agentNameSnapshot,
    agentEmail: row.agentEmailSnapshot,
    fromSupervisorName: resolveRoleUserName(row.fromSupervisor),
    toSupervisorName: resolveRoleUserName(row.toSupervisor),
    requestedByName: resolveRoleUserName(row.transferredBy),
    note: row.note,
    requestedAt: row.requestedAt.toISOString(),
    pendingAuditCount: counts[index] ?? 0,
  }));
}

const transferInclude = {
  agentUser: { select: { name: true, email: true } },
  fromSupervisor: { select: { name: true, email: true } },
  toSupervisor: { select: { name: true, email: true } },
  transferredBy: { select: { name: true, email: true } },
  reviewedBy: { select: { name: true, email: true } },
  revertedBy: { select: { name: true, email: true } },
} as const;

type RevertView = {
  canRevert: boolean;
  revertBlockedReason: string | null;
  revertWindowEndsAt: string | null;
};

const NO_REVERT: RevertView = {
  canRevert: false,
  revertBlockedReason: null,
  revertWindowEndsAt: null,
};

function mapTransferRow(
  row: {
    id: string;
    kind: "TRANSFER" | "REVERT";
    version: number;
    revertOfTransferId: string | null;
    revertedAt: Date | null;
    revertReason: string | null;
    revertedBy: { name: string | null; email: string } | null;
    agentNameSnapshot: string;
    agentEmailSnapshot: string;
    note: string | null;
    auditCountAtTransfer: number;
    status: AgentTransferStatus;
    requestedAt: Date;
    transferredAt: Date | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    fromSupervisor: { name: string | null; email: string };
    toSupervisor: { name: string | null; email: string };
    transferredBy: { name: string | null; email: string };
    reviewedBy: { name: string | null; email: string } | null;
  },
  revert: RevertView = NO_REVERT
): AgentTransferRow {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    revertOfTransferId: row.revertOfTransferId,
    revertedAt: row.revertedAt?.toISOString() ?? null,
    revertedByName: row.revertedBy ? resolveRoleUserName(row.revertedBy) : null,
    revertReason: row.revertReason,
    ...revert,
    agentName: row.agentNameSnapshot,
    agentEmail: row.agentEmailSnapshot,
    fromSupervisorName: resolveRoleUserName(row.fromSupervisor),
    toSupervisorName: resolveRoleUserName(row.toSupervisor),
    transferredByName: resolveRoleUserName(row.transferredBy),
    note: row.note,
    auditCountAtTransfer: row.auditCountAtTransfer,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    transferredAt: row.transferredAt?.toISOString() ?? null,
    reviewedByName: row.reviewedBy ? resolveRoleUserName(row.reviewedBy) : null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
  };
}

export async function getAgentTransferHistory(): Promise<{
  transfers: AgentTransferRow[];
  historyAudits: TransferHistoryAuditRow[];
}> {
  await requirePermission(PERMISSIONS.USERS_READ_MANAGED);
  const session = await requireAuth();
  await reconcileTransferHistoryForViewer(
    session.user.id,
    session.user.role.slug
  );

  let transferWhere: Prisma.AgentTransferWhereInput | undefined;

  if (isSuperAdmin(session.user.role) || session.user.role.slug === SYSTEM_ROLE_SLUGS.ADMIN) {
    transferWhere = undefined;
  } else if (isSupervisorTierRole(session.user.role.slug)) {
    transferWhere = {
      OR: [
        { fromSupervisorId: session.user.id },
        { toSupervisorId: session.user.id },
        { transferredById: session.user.id },
      ],
    };
  } else if (session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    const [submittedAgents, qaTransferIds] = await Promise.all([
      prisma.auditSubmission.findMany({
        where: { submittedById: session.user.id },
        select: { agent: true },
        distinct: ["agent"],
      }),
      fetchApprovedTransferIdsForQa(session.user.id),
    ]);
    const agentNameFilter = caseInsensitiveIn(
      submittedAgents.map((row) => row.agent)
    );
    const or: Prisma.AgentTransferWhereInput[] = [
      { transferredById: session.user.id },
      ...(qaTransferIds.length > 0 ? [{ id: { in: qaTransferIds } }] : []),
      ...(agentNameFilter ? [{ agentNameSnapshot: agentNameFilter }] : []),
    ];
    transferWhere = { OR: or };
  } else if (session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const [supervisorIds, approvedNames] = await Promise.all([
      fetchCreatedSupervisorIds(session.user.id),
      fetchQmApprovedAgentDisplayNames(session.user.id),
    ]);
    const agentNameFilter = caseInsensitiveIn(approvedNames);
    const or: Prisma.AgentTransferWhereInput[] = [
      { assignedReviewerId: session.user.id },
      { reviewedById: session.user.id },
      { transferredById: session.user.id },
    ];
    if (supervisorIds.length > 0) {
      or.push({ fromSupervisorId: { in: supervisorIds } });
      or.push({ toSupervisorId: { in: supervisorIds } });
    }
    if (agentNameFilter) {
      or.push({ agentNameSnapshot: agentNameFilter });
    }
    transferWhere = { OR: or };
  } else {
    transferWhere = { id: "__none__" };
  }

  const transfers = await prisma.agentTransfer.findMany({
    where: transferWhere,
    include: transferInclude,
    orderBy: [{ requestedAt: "desc" }],
    take: 200,
  });

  const approvedTransferIds = transfers
    .filter((row) => row.status === "APPROVED")
    .map((row) => row.id);

  const historyAudits =
    approvedTransferIds.length === 0
      ? []
      : await prisma.auditSubmission.findMany({
          where: {
            isHistory: true,
            historyTransferId: { in: approvedTransferIds },
          },
          select: {
            id: true,
            auditCode: true,
            agent: true,
            supervisor: true,
            auditDate: true,
            qualityPct: true,
            finalPct: true,
            grade: true,
            hasFatal: true,
            historyTransferId: true,
            historyTransfer: { select: { transferredAt: true } },
          },
          orderBy: { auditDate: "desc" },
          take: 500,
        });

  const revertViews = new Map<string, RevertView>();
  const viewerMayRevert =
    isAgentTransferRevertEnabled() &&
    (isSuperAdmin(session.user.role) ||
      session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER);
  if (viewerMayRevert) {
    const candidateIds = transfers
      .filter((row) => row.kind === "TRANSFER" && row.status === "APPROVED")
      .map((row) => row.id);
    if (candidateIds.length > 0) {
      const eligibility = await getRevertEligibilityForTransfers(prisma, {
        transferIds: candidateIds,
        actor: { id: session.user.id, roleSlug: session.user.role.slug },
        windowDays: getAgentTransferRevertWindowDays(),
      });
      for (const [id, result] of eligibility) {
        // Hide the button entirely for transfers this viewer may never revert.
        if (!result.ok && (result.code === "FORBIDDEN" || result.code === "NOT_REVERTIBLE")) {
          continue;
        }
        revertViews.set(id, {
          canRevert: result.ok,
          revertBlockedReason: result.ok ? null : result.message,
          revertWindowEndsAt: result.windowEndsAt?.toISOString() ?? null,
        });
      }
    }
  }

  return {
    transfers: transfers.map((row) =>
      mapTransferRow(row, revertViews.get(row.id) ?? NO_REVERT)
    ),
    historyAudits: historyAudits.map((row) => ({
      id: row.id,
      auditCode: row.auditCode,
      agent: row.agent,
      supervisor: row.supervisor,
      auditDate: row.auditDate,
      qualityPct: row.qualityPct,
      finalPct: row.finalPct,
      grade: row.grade,
      hasFatal: row.hasFatal,
      transferId: row.historyTransferId ?? "",
      transferredAt: row.historyTransfer?.transferredAt?.toISOString() ?? "",
    })),
  };
}

export async function countPendingHistoryAuditsForAgent(
  agentUserId: string
): Promise<number> {
  await requirePermission(PERMISSIONS.USERS_MANAGE_MANAGED);
  const session = await requireAuth();

  const manageError = await assertActorManagesUser(
    session.user.id,
    session.user.role,
    agentUserId
  );
  if (manageError && !isSuperAdmin(session.user.role)) {
    if (session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
      return 0;
    }
  }

  const agent = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: { name: true, email: true },
  });
  if (!agent) return 0;

  return countWorkingAuditsForAgent(agentUserId, resolveRoleUserName(agent));
}

/** Agent user IDs with a pending supervisor transfer (scoped to viewer when applicable). */
export async function getPendingTransferAgentIdsForSession(): Promise<string[]> {
  await requirePermission(PERMISSIONS.USERS_READ_MANAGED);
  const session = await requireAuth();

  const where: Prisma.AgentTransferWhereInput = { status: "PENDING" };

  if (isSuperAdmin(session.user.role)) {
    // all pending
  } else if (isSupervisorTierRole(session.user.role.slug)) {
    where.OR = [
      { fromSupervisorId: session.user.id },
      { toSupervisorId: session.user.id },
      { transferredById: session.user.id },
    ];
  } else if (session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    where.OR = [
      { assignedReviewerId: session.user.id },
      { assignedReviewerId: null },
    ];
  } else if (session.user.role.slug === SYSTEM_ROLE_SLUGS.ADMIN) {
    // all pending for admin read scope
  } else {
    return [];
  }

  const rows = await prisma.agentTransfer.findMany({
    where,
    select: { agentUserId: true },
  });

  return [...new Set(rows.map((row) => row.agentUserId))];
}

export async function getAgentTransferRevertPreview(
  transferId: string
): Promise<{ preview: RevertPreview } | { error: string }> {
  await requirePermission(PERMISSIONS.USERS_APPROVE_AGENT);
  const session = await requireAuth();
  if (!isAgentTransferRevertEnabled()) {
    return { error: "Transfer revert is disabled." };
  }
  if (
    session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    !isSuperAdmin(session.user.role)
  ) {
    return permissionError();
  }
  const id = z.string().min(1).safeParse(transferId);
  if (!id.success) return { error: "Invalid transfer." };

  const preview = await previewAgentTransferRevert(prisma, {
    transferId: id.data,
    actor: { id: session.user.id, roleSlug: session.user.role.slug },
    windowDays: getAgentTransferRevertWindowDays(),
  });
  if (!preview || preview.blockedCode === "FORBIDDEN") {
    return { error: "Transfer not found." };
  }
  return { preview };
}

export async function revertAgentTransfer(input: {
  transferId: string;
  reason: string;
  idempotencyKey: string;
  expectedVersion?: number;
}) {
  await requirePermission(PERMISSIONS.USERS_APPROVE_AGENT);
  const session = await requireAuth();

  if (!isAgentTransferRevertEnabled()) {
    return { error: "Transfer revert is disabled." };
  }
  if (
    session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    !isSuperAdmin(session.user.role)
  ) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "agent:transfer-revert",
    { limit: 10, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = revertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid revert request." };
  }

  const actor = { id: session.user.id, roleSlug: session.user.role.slug };
  let result;
  try {
    result = await prisma.$transaction(
      (tx) =>
        revertAgentTransferInTx(tx, {
          transferId: parsed.data.transferId,
          actor,
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          expectedVersion: parsed.data.expectedVersion ?? null,
          windowDays: getAgentTransferRevertWindowDays(),
        }),
      { timeout: 30_000 }
    );
  } catch (error) {
    if (error instanceof TransferExecutionError) {
      return { error: error.message };
    }
    if (isPrismaUniqueViolation(error)) {
      // Concurrent double-submit with the same idempotency key or a second
      // revert racing for the same transfer: the other request won.
      return { error: "This transfer was already reverted." };
    }
    throw error;
  }

  if (!result.alreadyApplied) {
    invalidateAgentAssignmentCaches(
      result.fromSupervisorId,
      result.toSupervisorId,
      undefined,
      [result.receivingQaUserId, result.restoredQaUserId].filter(
        (id): id is string => Boolean(id)
      )
    );
    revalidateTransferPaths([
      session.user.id,
      result.fromSupervisorId,
      result.toSupervisorId,
      result.receivingQaUserId,
      result.restoredQaUserId,
      result.fromSupervisorQmId,
      result.agentUserId,
    ]);

    try {
      const [from, to, toQmId] = await Promise.all([
        prisma.user.findUnique({
          where: { id: result.fromSupervisorId },
          select: { name: true, email: true, teamName: true },
        }),
        prisma.user.findUnique({
          where: { id: result.toSupervisorId },
          select: { name: true, email: true, teamName: true },
        }),
        resolveRespectiveQmId(result.toSupervisorId),
      ]);
      await emitAgentTransferRevertedEvents({
        transferId: result.transferId,
        revertTransferId: result.revertTransferId,
        agentUserId: result.agentUserId,
        agentName: result.agentName,
        fromSupervisorId: result.fromSupervisorId,
        toSupervisorId: result.toSupervisorId,
        qaUserIds: [result.receivingQaUserId, result.restoredQaUserId],
        qmUserIds: [result.fromSupervisorQmId, toQmId],
        actorUserId: session.user.id,
        fromLabel: from ? supervisorLabel(from) : "the previous team",
        toLabel: to ? supervisorLabel(to) : "the other team",
        reason: parsed.data.reason,
      });
    } catch (error) {
      console.error("Agent transfer revert notifications failed:", error);
    }
  }

  const qaNote = result.qaRestoreSkipped
    ? " The previous QA is no longer active, so no QA was reassigned."
    : "";
  return {
    success: true as const,
    revertTransferId: result.revertTransferId,
    restoredAuditCount: result.restoredAuditCount,
    heldAuditCount: result.heldAuditCount,
    message: result.alreadyApplied
      ? "This transfer was already reverted."
      : `Transfer reverted. ${result.restoredAuditCount} audit(s) restored to the previous team; ${result.heldAuditCount} audit(s) kept as history for the other team.${qaNote}`,
  };
}
