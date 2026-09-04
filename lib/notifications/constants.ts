export const NOTIFICATION_TYPES = {
  FATAL_AUDIT: "fatal_audit",
  DISPUTE_RAISED: "dispute_raised",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
