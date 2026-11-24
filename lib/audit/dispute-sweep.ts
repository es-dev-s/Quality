import { DISPUTE_SLA_HOURS, HOUR_MS } from "@/lib/audit/dispute";
import { prisma } from "@/lib/prisma";

/**
 * Close disputes whose final-acknowledgement deadline passed (escalation
 * expiry). One indexed UPDATE; run when disputes or audit logs are read
 * because the app has no background scheduler.
 */
export async function closeExpiredDisputes(now: Date = new Date()) {
  const cutoff = new Date(
    now.getTime() - DISPUTE_SLA_HOURS.finalAcknowledge * HOUR_MS
  );
  const result = await prisma.auditSubmission.updateMany({
    where: {
      disputeStage: "AWAITING_FINAL_ACK",
      disputeResharedAt: { lt: cutoff },
    },
    data: {
      disputeStage: "CLOSED",
      disputeClosedAt: now,
      disputeCloseReason: "ESCALATION_EXPIRED",
    },
  });
  return result.count;
}
