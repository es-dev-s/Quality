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

class TransferExecutionError extends Error {
  constructor(
    readonly code: "ALREADY_REVIEWED" | "SUPERVISOR_CHANGED" | "PENDING_EXISTS",
    message: string
  ) {
    super(message);
    this.name = "TransferExecutionError";
  }
}

const transferSchema = z.object({
  agentUserId: z.string().min(1),
  toSupervisorId: z.string().min(1),
  note: z.string().trim().max(2000).optional(),
});

const reviewSchema = z.object({
  transferId: z.string().min(1),
  reviewNote: z.string().trim().max(2000).optional(),
});

export type TransferTargetSupervisor = {
  id: string;
  name: string;
  email: string;
  teamName: string | null;
};

export type AgentTransferRow = {
  id: string;
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

function revalidateTransferPaths(userIds: string[]) {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/audit-transfer-history");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");
  invalidateInteractionConfigCaches();
  for (const userId of userIds) {
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

async function countWorkingAuditsForAgentName(agentDisplayName: string): Promise<number> {
  const agentFilter = caseInsensitiveIn([agentDisplayName]);
  return prisma.auditSubmission.count({
    where: {
      isHistory: false,
      ...(agentFilter ? { agent: agentFilter } : { agent: agentDisplayName }),
    },
  });
}

async function executeAgentTransfer(
  tx: Prisma.TransactionClient,
  params: {
    transferId: string;
    agentUserId: string;
    agentDisplayName: string;
    fromSupervisorId: string;
    toSupervisorId: string;
  }
) {
  const { transferId, agentUserId, agentDisplayName, fromSupervisorId, toSupervisorId } =
    params;

  const agentNameFilter = caseInsensitiveIn([agentDisplayName]);

  const fromSupervisor = await tx.user.findUnique({
    where: { id: fromSupervisorId },
    select: { teamName: true },
  });
  const previousTeamName = fromSupervisor?.teamName?.trim() || null;

  if (previousTeamName) {
    await tx.auditSubmission.updateMany({
      where: {
        isHistory: false,
        teamNameSnapshot: null,
        ...(agentNameFilter
          ? { agent: agentNameFilter }
          : { agent: agentDisplayName }),
      },
      data: { teamNameSnapshot: previousTeamName },
    });
  }

  const tagResult = await tx.auditSubmission.updateMany({
    where: {
      isHistory: false,
      ...(agentNameFilter ? { agent: agentNameFilter } : { agent: agentDisplayName }),
    },
    data: {
      isHistory: true,
      historyOwnerId: fromSupervisorId,
      historyTransferId: transferId,
    },
  });

  await tx.agentTransfer.update({
    where: { id: transferId },
    data: {
      auditCountAtTransfer: tagResult.count,
      status: "APPROVED",
      transferredAt: new Date(),
    },
  });

  await tx.agentAssignment.deleteMany({
    where: { agentId: agentUserId },
  });

  const ownershipUpdate = await tx.user.updateMany({
    where: {
      id: agentUserId,
      createdById: fromSupervisorId,
    },
    data: { createdById: toSupervisorId },
  });

  if (ownershipUpdate.count === 0) {
    throw new TransferExecutionError(
      "SUPERVISOR_CHANGED",
      "Agent supervisor changed before transfer could complete."
    );
  }

  return tagResult.count;
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
  excludeSupervisorId?: string
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

        const auditCount = await executeAgentTransfer(tx, {
          transferId: transfer.id,
          agentUserId: agentUser.id,
          agentDisplayName,
          fromSupervisorId,
          toSupervisorId: targetSupervisor.id,
        });

        return {
          transferId: transfer.id,
          auditCount,
        };
      });

      invalidateAgentAssignmentCaches(session.user.id, targetSupervisor.id);
      revalidateTransferPaths([
        session.user.id,
        fromSupervisorId,
        targetSupervisor.id,
      ]);

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

  const pendingAuditCount = await countWorkingAuditsForAgentName(agentDisplayName);

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

  if (transfer.agentUser.createdById !== transfer.fromSupervisorId) {
    return {
      error:
        "This agent's supervisor changed since the request was submitted. Reject and submit a new transfer.",
    };
  }

  const agentDisplayName = resolveRoleUserName(transfer.agentUser);

  try {
    const auditCount = await prisma.$transaction(async (tx) => {
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

      const currentAgent = await tx.user.findUnique({
        where: { id: transfer.agentUserId },
        select: { createdById: true },
      });
      if (currentAgent?.createdById !== transfer.fromSupervisorId) {
        await tx.agentTransfer.update({
          where: { id: transfer.id },
          data: {
            status: "REJECTED",
            reviewNote:
              parsed.data.reviewNote?.trim() ||
              "Rejected automatically: agent supervisor changed since request was submitted.",
          },
        });
        throw new TransferExecutionError(
          "SUPERVISOR_CHANGED",
          "This agent's supervisor changed since the request was submitted. Reject and submit a new transfer."
        );
      }

      return executeAgentTransfer(tx, {
        transferId: transfer.id,
        agentUserId: transfer.agentUserId,
        agentDisplayName,
        fromSupervisorId: transfer.fromSupervisorId,
        toSupervisorId: transfer.toSupervisorId,
      });
    });

    invalidateAgentAssignmentCaches(
      transfer.fromSupervisorId,
      transfer.toSupervisorId
    );
    revalidateTransferPaths([
      session.user.id,
      transfer.fromSupervisorId,
      transfer.toSupervisorId,
      transfer.transferredById,
    ]);

    return {
      success: true as const,
      message: `Transfer approved. ${auditCount} audit(s) marked as history for the previous supervisor.`,
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
    rows.map((row) => countWorkingAuditsForAgentName(row.agentNameSnapshot))
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
} as const;

function mapTransferRow(
  row: {
    id: string;
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
  }
): AgentTransferRow {
  return {
    id: row.id,
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
  } else if (session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    transferWhere = undefined;
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

  return {
    transfers: transfers.map(mapTransferRow),
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

  return countWorkingAuditsForAgentName(resolveRoleUserName(agent));
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
