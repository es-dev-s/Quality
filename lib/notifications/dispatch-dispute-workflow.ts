import { NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { persistAndBroadcastNotification } from "@/lib/notifications/persist";
import {
  findAgentUserId,
  resolveQualityManagerIds,
} from "@/lib/notifications/resolve-dispute-recipients";

type AuditRef = {
  auditId: string;
  auditCode: string;
  agent: string;
};

/** Immediate notice to the Quality Manager once the team lead submits a remark. */
export async function dispatchDisputeRemarkSubmitted(
  input: AuditRef & { submittedById: string }
): Promise<number> {
  const managerIds = await resolveQualityManagerIds(
    input.agent,
    input.submittedById
  );
  const results = await Promise.all(
    managerIds.map((userId) =>
      persistAndBroadcastNotification({
        userId,
        type: NOTIFICATION_TYPES.DISPUTE_REMARK_SUBMITTED,
        title: "Dispute ready for review",
        body: `${input.auditCode} · ${input.agent} · team lead remark submitted. Review within 24 hours.`,
        auditId: input.auditId,
        auditCode: input.auditCode,
        meta: { role: "manager" },
      })
    )
  );
  return results.filter(Boolean).length;
}

/** Tell the agent their dispute was resolved and the audit was reshared. */
export async function dispatchDisputeResolved(
  input: AuditRef & { outcome: "UPHELD" | "REVISED"; resolvedById: string }
): Promise<number> {
  const agentUserId = await findAgentUserId(input.agent);
  if (!agentUserId || agentUserId === input.resolvedById) return 0;

  const result = await persistAndBroadcastNotification({
    userId: agentUserId,
    type: NOTIFICATION_TYPES.DISPUTE_RESOLVED,
    title:
      input.outcome === "REVISED"
        ? "Dispute accepted — audit revised"
        : "Dispute reviewed — audit upheld",
    body: `${input.auditCode} · acknowledge within 24 hours.`,
    auditId: input.auditId,
    auditCode: input.auditCode,
    meta: { role: "agent", outcome: input.outcome },
  });
  return result ? 1 : 0;
}
