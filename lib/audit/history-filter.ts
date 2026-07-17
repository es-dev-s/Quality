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
  records: readonly { isHistory?: boolean }[]
): AuditHistoryFilter {
  return records.some((row) => row.isHistory) ? "all" : "working";
}

export const AUDIT_HISTORY_FILTER_OPTIONS: {
  value: AuditHistoryFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "working", label: "Working" },
  { value: "history", label: "History" },
];
