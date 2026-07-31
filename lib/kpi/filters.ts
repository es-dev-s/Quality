import type { DateRangeFilter } from "@/lib/audit/date-filters";

/** KPI time presets shown in the filter dropdown. */
export const KPI_TIME_OPTIONS: {
  value: DateRangeFilter;
  label: string;
}[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "custom", label: "Custom date" },
];

export type KpiFilterOptions = {
  qualityManagers: string[];
  qualityAnalysts: string[];
  /**
   * Quality Manager display name → active agent display names on their roster
   * (approved or assigned — same rule as dashboard QM scope).
   */
  qmAgentNamesByQm: Record<string, string[]>;
};

export type KpiFiltersState = {
  time: DateRangeFilter;
  customFrom: string;
  customTo: string;
  qm: string;
  qa: string;
};

export const DEFAULT_KPI_FILTERS: KpiFiltersState = {
  time: "month",
  customFrom: "",
  customTo: "",
  qm: "",
  qa: "",
};

export function countActiveKpiFilters(filters: KpiFiltersState): number {
  let count = 0;
  if (filters.time !== DEFAULT_KPI_FILTERS.time) count += 1;
  if (filters.qm) count += 1;
  if (filters.qa) count += 1;
  return count;
}
