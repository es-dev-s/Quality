/**
 * Agent transfer revert feature flags (env-driven, read at call time).
 *
 * AGENT_TRANSFER_REVERT_ENABLED       "false" / "0" / "off" disables revert (default: enabled)
 * AGENT_TRANSFER_REVERT_WINDOW_DAYS   revert window in days after the transfer (default: 7, max 90)
 */
export const DEFAULT_REVERT_WINDOW_DAYS = 7;
const MAX_REVERT_WINDOW_DAYS = 90;

export function isAgentTransferRevertEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env.AGENT_TRANSFER_REVERT_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !["false", "0", "off", "no", "disabled"].includes(raw);
}

export function getAgentTransferRevertWindowDays(
  env: Record<string, string | undefined> = process.env
): number {
  const parsed = Number(env.AGENT_TRANSFER_REVERT_WINDOW_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REVERT_WINDOW_DAYS;
  return Math.min(Math.floor(parsed), MAX_REVERT_WINDOW_DAYS);
}

export function revertWindowEndsAt(transferredAt: Date, windowDays: number): Date {
  return new Date(transferredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}
