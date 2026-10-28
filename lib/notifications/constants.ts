export const NOTIFICATION_TYPES = {
  FATAL_AUDIT: "fatal_audit",
  DISPUTE_RAISED: "dispute_raised",
  AGENT_TRANSFERRED: "agent_transferred",
  AGENT_TRANSFER_REVERTED: "agent_transfer_reverted",
  /** Sent to the agent themself (they cannot open transfer history). */
  AGENT_TEAM_CHANGED: "agent_team_changed",
} as const;

const TRANSFER_HISTORY_TYPES: ReadonlySet<string> = new Set([
  NOTIFICATION_TYPES.AGENT_TRANSFERRED,
  NOTIFICATION_TYPES.AGENT_TRANSFER_REVERTED,
]);

/** Notification types that link somewhere other than an audit. */
export function notificationHrefForType(type: string): string | null {
  if (TRANSFER_HISTORY_TYPES.has(type)) return "/audit-transfer-history";
  if (type === NOTIFICATION_TYPES.AGENT_TEAM_CHANGED) return "/dashboard";
  return null;
}

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
