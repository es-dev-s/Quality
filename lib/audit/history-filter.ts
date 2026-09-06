/** Client-side filter for working vs history audit rows. */
export type AuditHistoryFilter = "working" | "history" | "all";

export function filterByAuditHistory<T extends { isHistory?: boolean }>(
  records: readonly T[],
  filter: AuditHistoryFilter
): T[] {
  if (filter === "all") return [...records];
  if (filter === "working") return records.filter((row) => !row.isHistory);
  return records.filter((row) => row.isHistory);
}

export function defaultAuditHistoryFilter(
  _records?: readonly { isHistory?: boolean }[]
): AuditHistoryFilter {
  // Working only — history rows are transferred snapshots and must not
  // inflate dashboard / analytics / audit-log totals by default.
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
