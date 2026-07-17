import { prisma } from "@/lib/prisma";

/** History audits are immutable — block all mutations. */
export async function assertAuditNotHistory(
  auditId: string
): Promise<string | null> {
  const row = await prisma.auditSubmission.findUnique({
    where: { id: auditId },
    select: { isHistory: true },
  });
  if (!row) {
    return "Audit not found.";
  }
  if (row.isHistory) {
    return "History audits cannot be edited.";
  }
  return null;
}
