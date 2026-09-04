import { persistAndBroadcastNotification } from "@/lib/notifications/persist";
import { resolveDisputeAuditRecipients } from "@/lib/notifications/resolve-dispute-recipients";
import { NOTIFICATION_TYPES } from "@/lib/notifications/constants";

export type DispatchDisputeAuditInput = {
  auditId: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  submittedById: string;
  disputedById: string;
};

/** Persist + realtime push when an agent marks an audit as disputed. */
export async function dispatchDisputeAuditNotifications(
  input: DispatchDisputeAuditInput
): Promise<number> {
  const recipients = await resolveDisputeAuditRecipients({
    agent: input.agent,
    supervisor: input.supervisor,
    auditor: input.auditor,
    submittedById: input.submittedById,
    excludeUserId: input.disputedById,
  });

  if (recipients.length === 0) return 0;

  const title = "Audit dispute raised";
  const body = `${input.auditCode} · ${input.agent}${
    input.auditor?.trim() ? ` · QA ${input.auditor.trim()}` : ""
  }`;

  const results = await Promise.all(
    recipients.map(({ userId, role }) =>
      persistAndBroadcastNotification({
        userId,
        type: NOTIFICATION_TYPES.DISPUTE_RAISED,
        title,
        body,
        auditId: input.auditId,
        auditCode: input.auditCode,
        meta: { role },
      })
    )
  );

  return results.filter(Boolean).length;
}
