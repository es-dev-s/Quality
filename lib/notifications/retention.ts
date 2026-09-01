/** Notifications older than this are deleted and never shown. */
export const NOTIFICATION_RETENTION_DAYS = 10;

/** Safety cap for the bell list inside the 10-day window. */
export const NOTIFICATION_LIST_MAX = 100;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function notificationRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * MS_PER_DAY);
}

export function isNotificationWithinRetention(
  createdAt: string | Date,
  now = new Date()
): boolean {
  const created =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() >= notificationRetentionCutoff(now).getTime();
}
