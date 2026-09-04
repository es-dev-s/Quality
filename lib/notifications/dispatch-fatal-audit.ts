import { resolveFatalAuditRecipients } from "@/lib/notifications/resolve-fatal-recipients";
import { persistAndBroadcastNotification } from "@/lib/notifications/persist";
import { NOTIFICATION_TYPES } from "@/lib/notifications/constants";

export type DispatchFatalAuditInput = {
  auditId: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  type: string;
  fatalList: string[];
  submittedById: string;
};

function buildFatalNotificationCopy(input: DispatchFatalAuditInput): {
  title: string;
  body: string;
} {
  const fatalSummary =
    input.fatalList.length > 0
      ? input.fatalList.slice(0, 3).join(", ")
      : "Fatal parameter marked";
  const auditorPart = input.auditor?.trim()
    ? ` · QA ${input.auditor.trim()}`
    : "";

  return {
    title: `Fatal ${input.type} audit flagged`,
    body: `${input.auditCode} · ${input.agent}${auditorPart} — ${fatalSummary}`,
  };
}

/** Persist + realtime push when QA marks an audit fatal. */
export async function dispatchFatalAuditNotifications(
  input: DispatchFatalAuditInput
): Promise<number> {
  const recipients = await resolveFatalAuditRecipients({
    agent: input.agent,
    supervisor: input.supervisor,
    excludeUserId: input.submittedById,
  });

  if (recipients.length === 0) return 0;

  const copy = buildFatalNotificationCopy(input);

  const results = await Promise.all(
    recipients.map(({ userId, role }) =>
      persistAndBroadcastNotification({
        userId,
        type: NOTIFICATION_TYPES.FATAL_AUDIT,
        title: copy.title,
        body: copy.body,
        auditId: input.auditId,
        auditCode: input.auditCode,
        meta: {
          role,
          interactionType: input.type,
          fatalList: input.fatalList,
        },
      })
    )
  );

  return results.filter(Boolean).length;
}

export { mapNotificationRow } from "@/lib/notifications/map-row";
