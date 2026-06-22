import type { DateRangeValue } from "@/components/primitives/date-range-picker";
import {
  computeQmsAnalytics,
  type AnalyticsAuditRecord,
} from "@/lib/audit/analytics-metrics";
import {
  filterByCustomRange,
  filterByPeriod,
  type DashboardPeriod,
} from "@/lib/audit/dashboard-metrics";
import type { DashboardAuditRecord } from "@/lib/audit/dashboard-metrics";
import { computeLeaderboardAnalytics } from "@/lib/audit/leaderboard-metrics";

export type AnalyticsIncludeFilters = {
  agent: string;
  teamName: string;
  auditor: string;
};

export const EMPTY_ANALYTICS_INCLUDE_FILTERS: AnalyticsIncludeFilters = {
  agent: "",
  teamName: "",
  auditor: "",
};

export type AnalyticsFilterOptions = {
  agents: string[];
  teamNames: string[];
  auditors: string[];
};

export const ANALYTICS_PERIOD_PRESETS: {
  id: Exclude<DashboardPeriod, "yesterday" | "custom">;
  label: string;
  ariaLabel: string;
}[] = [
  { id: "today", label: "Day", ariaLabel: "Today" },
  { id: "week", label: "Week", ariaLabel: "This week" },
  { id: "month", label: "Month", ariaLabel: "This month" },
  { id: "overall", label: "Overall", ariaLabel: "All time" },
];

function asDashboardRecords(records: AnalyticsAuditRecord[]): DashboardAuditRecord[] {
  return records as unknown as DashboardAuditRecord[];
}

export function extractAnalyticsFilterOptions(
  records: AnalyticsAuditRecord[]
): AnalyticsFilterOptions {
  const agents = new Set<string>();
  const teamNames = new Set<string>();
  const auditors = new Set<string>();

  for (const record of records) {
    if (record.agent) agents.add(record.agent);
    if (record.supervisor) teamNames.add(record.supervisor);
    if (record.auditor) auditors.add(record.auditor);
  }

  const sort = (values: Set<string>) =>
    Array.from(values).sort((a, b) => a.localeCompare(b));

  return {
    agents: sort(agents),
    teamNames: sort(teamNames),
    auditors: sort(auditors),
  };
}

export function filterAnalyticsByInclude(
  records: AnalyticsAuditRecord[],
  filters: AnalyticsIncludeFilters
): AnalyticsAuditRecord[] {
  return records.filter((record) => {
    if (filters.agent && record.agent !== filters.agent) return false;
    if (filters.teamName && record.supervisor !== filters.teamName) {
      return false;
    }
    if (filters.auditor && record.auditor !== filters.auditor) return false;
    return true;
  });
}

export function hasActiveAnalyticsIncludeFilters(
  filters: AnalyticsIncludeFilters
): boolean {
  return Boolean(filters.agent || filters.teamName || filters.auditor);
}

export function filterAnalyticsByPeriod(
  records: AnalyticsAuditRecord[],
  period: DashboardPeriod,
  now = new Date()
): AnalyticsAuditRecord[] {
  if (period === "overall" || period === "custom") return records;
  return filterByPeriod(asDashboardRecords(records), period, now) as unknown as AnalyticsAuditRecord[];
}

export function filterAnalyticsByCustomRange(
  records: AnalyticsAuditRecord[],
  from: string,
  to: string
): AnalyticsAuditRecord[] {
  if (!from && !to) return records;
  return filterByCustomRange(
    asDashboardRecords(records),
    from,
    to
  ) as unknown as AnalyticsAuditRecord[];
}

export function applyAnalyticsFilters(
  records: AnalyticsAuditRecord[],
  options: {
    period: DashboardPeriod;
    customRange: DateRangeValue;
    includeFilters: AnalyticsIncludeFilters;
    referenceNow: Date;
  }
) {
  let filtered = filterAnalyticsByInclude(records, options.includeFilters);

  if (options.customRange.from || options.customRange.to) {
    filtered = filterAnalyticsByCustomRange(
      filtered,
      options.customRange.from,
      options.customRange.to
    );
  } else {
    filtered = filterAnalyticsByPeriod(
      filtered,
      options.period,
      options.referenceNow
    );
  }

  return {
    ...computeQmsAnalytics(filtered),
    leaderboards: computeLeaderboardAnalytics(filtered),
    filteredCount: filtered.length,
  };
}
