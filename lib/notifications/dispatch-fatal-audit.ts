import { resolveFatalAuditRecipients } from "@/lib/notifications/resolve-fatal-recipients";
import type { NotificationItem } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import { broadcastToUser } from "@/lib/sse-broadcast";

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

function mapRow(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  auditId: string | null;
  auditCode: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    auditId: row.auditId,
    auditCode: row.auditCode,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    href: row.auditCode
      ? `/audit-logs?search=${encodeURIComponent(row.auditCode)}`
      : row.auditId
        ? `/audit-logs?search=${encodeURIComponent(row.auditId)}`
        : "/audit-logs",
  };
}

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

  await Promise.all(
    recipients.map(async ({ userId, role }) => {
      const created = await prisma.notification.create({
        data: {
          userId,
          type: "fatal_audit",
          title: copy.title,
          body: copy.body,
          auditId: input.auditId,
          auditCode: input.auditCode,
          meta: {
            role,
            interactionType: input.type,
            fatalList: input.fatalList,
          },
        },
      });

      const notification = mapRow(created);
      broadcastToUser(userId, {
        type: "notification:new",
        notification,
      });
    })
  );

  return recipients.length;
}

export { mapRow as mapNotificationRow };
