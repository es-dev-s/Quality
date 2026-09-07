/** Client-side filter for working vs history audit rows. */
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";

export type AuditHistoryFilter = "working" | "history" | "all";

export function filterByAuditHistory<T extends { isHistory?: boolean }>(
  records: readonly T[],
  filter: AuditHistoryFilter
): T[] {
  if (filter === "all") return [...records];
  if (filter === "working") return records.filter((row) => !row.isHistory);
  return records.filter((row) => row.isHistory);
}

/** These roles only receive history rows that already belong to them. */
export function viewerDefaultsToOwnedHistory(roleSlug?: string): boolean {
  if (!roleSlug) return false;
  return (
    isSupervisorTierRole(roleSlug) ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST ||
    roleSlug === SYSTEM_ROLE_SLUGS.AGENT ||
    roleSlug === SYSTEM_ROLE_SLUGS.MEMBER
  );
}

export function defaultAuditHistoryFilter(
  records?: readonly {
    isHistory?: boolean;
    historyOwnerId?: string | null;
  }[],
  viewerUserId?: string,
  roleSlug?: string
): AuditHistoryFilter {
  if (
    viewerDefaultsToOwnedHistory(roleSlug) &&
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
