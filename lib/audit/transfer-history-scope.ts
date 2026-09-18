import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SUPERVISOR_TIER_ROLE_SLUG_FILTER } from "@/lib/audit/supervisor-tier";
import { isPrismaSchemaMismatchError } from "@/lib/db/with-db-retry";

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/** History rows tagged to these transfer records. */
export function historyAuditsForTransferIds(
  transferIds: string[]
): Prisma.AuditSubmissionWhereInput | null {
  const ids = uniqueIds(transferIds);
  if (ids.length === 0) return null;
  return { isHistory: true, historyTransferId: { in: ids } };
}

/** History owned by, or transferred out of, these supervisors. */
export function historyAuditsForSupervisors(
  supervisorIds: string[]
): Prisma.AuditSubmissionWhereInput | null {
  const ids = uniqueIds(supervisorIds);
  if (ids.length === 0) return null;
  return {
    isHistory: true,
    OR: [
      { historyOwnerId: { in: ids } },
      { historyTransfer: { fromSupervisorId: { in: ids } } },
    ],
  };
}

export async function fetchCreatedSupervisorIds(
  qualityManagerId: string
): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      createdById: qualityManagerId,
      role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Transfers where this QA was the assigned analyst at handoff.
 * Avoids joining fromQaUserId on the audit hot path.
 */
export async function fetchApprovedTransferIdsForQa(
  qaUserId: string
): Promise<string[]> {
  try {
    const rows = await prisma.agentTransfer.findMany({
      where: { status: "APPROVED", fromQaUserId: qaUserId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  } catch (error) {
    if (isPrismaSchemaMismatchError(error)) {
      console.error(
        "QA transfer history skipped: agent_transfers.from_qa_user_id is missing"
      );
      return [];
    }
    throw error;
  }
}

/** Outgoing transfers from this QM's supervisors, or transfers this QM reviewed. */
export async function fetchApprovedTransferIdsForQm(
  qualityManagerId: string,
  supervisorIds: string[]
): Promise<string[]> {
  const or: Prisma.AgentTransferWhereInput[] = [
    { assignedReviewerId: qualityManagerId },
    { reviewedById: qualityManagerId },
  ];
  if (supervisorIds.length > 0) {
    or.push({ fromSupervisorId: { in: supervisorIds } });
  }

  try {
    const rows = await prisma.agentTransfer.findMany({
      where: { status: "APPROVED", OR: or },
      select: { id: true },
    });
    return uniqueIds(rows.map((row) => row.id));
  } catch (error) {
    if (isPrismaSchemaMismatchError(error)) {
      console.error("QM transfer history query failed:", error);
      return [];
    }
    throw error;
  }
}

export async function fetchFromSupervisorIdsForTransfers(
  transferIds: string[]
): Promise<string[]> {
  const ids = uniqueIds(transferIds);
  if (ids.length === 0) return [];
  const rows = await prisma.agentTransfer.findMany({
    where: { id: { in: ids } },
    select: { fromSupervisorId: true },
  });
  return uniqueIds(rows.map((row) => row.fromSupervisorId));
}
