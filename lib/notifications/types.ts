export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  auditId: string | null;
  auditCode: string | null;
  readAt: string | null;
  createdAt: string;
  href: string;
};

export type FatalRecipientRole = "agent" | "supervisor" | "manager";
