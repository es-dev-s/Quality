import type { NotificationItem } from "@/lib/notifications/types";

export function mapNotificationRow(row: {
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
