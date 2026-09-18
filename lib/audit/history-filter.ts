/** Client-side filter for working vs history audit rows. */
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";

export type AuditHistoryFilter = "working" | "history" | "all";
export type AuditHistorySurface = "logs" | "metrics";

export function filterByAuditHistory<T extends { isHistory?: boolean }>(
  records: readonly T[],
  filter: AuditHistoryFilter
): T[] {
  if (filter === "all") return [...records];
  if (filter === "working") return records.filter((row) => !row.isHistory);
  return records.filter((row) => row.isHistory);
}

/**
 * Team-scoped roles default to All whenever history is already in their payload.
 * QM / Super Admin do the same on Audit Logs, and stay on Working for dashboard
 * / analytics so current-team metrics are not mixed with transferred-out rows.
 * Agents never see transferred-out history.
 */
export function viewerCanAccessTransferHistory(roleSlug?: string): boolean {
  return Boolean(roleSlug) && roleSlug !== SYSTEM_ROLE_SLUGS.AGENT;
}

export function viewerDefaultsToOwnedHistory(
  roleSlug?: string,
  surface: AuditHistorySurface = "logs"
): boolean {
  if (!roleSlug || !viewerCanAccessTransferHistory(roleSlug)) return false;
  if (
    isSupervisorTierRole(roleSlug) ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST ||
    roleSlug === SYSTEM_ROLE_SLUGS.MEMBER
  ) {
    return true;
  }
  if (surface === "metrics") return false;
  return (
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN
  );
}

export function defaultAuditHistoryFilter(
  records?: readonly {
    isHistory?: boolean;
    historyOwnerId?: string | null;
  }[],
  viewerUserId?: string,
  roleSlug?: string,
  surface: AuditHistorySurface = "logs"
): AuditHistoryFilter {
  if (roleSlug === SYSTEM_ROLE_SLUGS.AGENT) return "working";
  if (
    viewerDefaultsToOwnedHistory(roleSlug, surface) &&
    records?.some((row) => row.isHistory)
  ) {
    return "all";
  }
  if (
    viewerUserId &&
    records?.some(
      (row) => row.isHistory && row.historyOwnerId === viewerUserId
    )
  ) {
    return "all";
  }
  return "working";
}

export const AUDIT_HISTORY_FILTER_OPTIONS: {
  value: AuditHistoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "working", label: "Working" },
  { value: "history", label: "History" },
];
