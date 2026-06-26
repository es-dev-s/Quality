import { PASS_RATE_QUALITY_THRESHOLD } from "@/lib/audit/metrics-config";
import { resolveMetricDate } from "@/lib/audit/metric-dates";

export type DashboardAuditRecord = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  lob: string;
  type: string;
  callDate: string;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
  hasFatal: boolean;
  fatalList: string[];
};

export type FatalOccurrenceRow = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  lob: string;
  type: string;
  callDate: string;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
};

export type TopAgentRow = {
  name: string;
  avg: number;
  count: number;
};

export type TopFatalRow = {
  name: string;
  count: number;
};

export type DashboardIncludeFilters = {
  agent: string;
  teamName: string;
  lob: string;
  auditor: string;
  auditType: string;
};

export const EMPTY_INCLUDE_FILTERS: DashboardIncludeFilters = {
  agent: "",
  teamName: "",
  lob: "",
  auditor: "",
  auditType: "",
};

export type DashboardFilterOptions = {
  agents: string[];
  teamNames: string[];
  lobs: string[];
  auditors: string[];
  auditTypes: string[];
};

export function extractFilterOptions(
  records: DashboardAuditRecord[]
): DashboardFilterOptions {
  const agents = new Set<string>();
  const teamNames = new Set<string>();
  const lobs = new Set<string>();
  const auditors = new Set<string>();
  const auditTypes = new Set<string>();

  for (const record of records) {
    if (record.agent) agents.add(record.agent);
    if (record.supervisor) teamNames.add(record.supervisor);
    if (record.lob) lobs.add(record.lob);
    if (record.auditor) auditors.add(record.auditor);
    if (record.type) auditTypes.add(record.type);
  }

  const sort = (values: Set<string>) =>
    Array.from(values).sort((a, b) => a.localeCompare(b));

  return {
    agents: sort(agents),
    teamNames: sort(teamNames),
    lobs: sort(lobs),
    auditors: sort(auditors),
    auditTypes: sort(auditTypes),
  };
}

export function filterByIncludeFilters(
  records: DashboardAuditRecord[],
  filters: DashboardIncludeFilters
): DashboardAuditRecord[] {
  return records.filter((record) => {
    if (filters.agent && record.agent !== filters.agent) {
      return false;
    }
    if (filters.teamName && record.supervisor !== filters.teamName) {
      return false;
    }
    if (filters.lob && record.lob !== filters.lob) {
      return false;
    }
    if (filters.auditor && record.auditor !== filters.auditor) {
      return false;
    }
    if (filters.auditType && record.type !== filters.auditType) {
      return false;
    }
    return true;
  });
}

export function hasActiveIncludeFilters(filters: DashboardIncludeFilters): boolean {
  return Boolean(
    filters.agent ||
      filters.teamName ||
      filters.lob ||
      filters.auditor ||
      filters.auditType
  );
}

export type DashboardPeriod =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "overall"
  | "custom";

export type TrendGranularity = "day" | "week" | "month";

export type ScoreBucket = {
  key: "excellent" | "good" | "average" | "poor";
  label: string;
  range: string;
  count: number;
  pct: number;
};

export type TrendPoint = {
  id: string;
  name: string;
  score: number;
  count: number;
};

export type TrendRangeBounds = {
  start: Date;
  end: Date;
};

export type TrendRangeInput = {
  period: DashboardPeriod;
  customFrom: string;
  customTo: string;
};

export type AgentTargetRow = {
  name: string;
  achieved: number;
  target: number;
  pct: number;
};

export type AuditorTargetRow = {
  name: string;
  achieved: number;
  target: number;
  pct: number;
};

function parseMetricDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function recordMetricDate(record: DashboardAuditRecord): Date {
  return parseMetricDate(
    resolveMetricDate(record.auditDate, record.callDate)
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekLabel(weekStart: Date): string {
  const m = String(weekStart.getMonth() + 1).padStart(2, "0");
  const d = String(weekStart.getDate()).padStart(2, "0");
  return `W/${m}-${d}`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatMonthLabel(date: Date): string {
  return MONTH_LABELS[date.getMonth()] ?? "—";
}

function formatDayLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()] ?? "—"} ${date.getDate()}`;
}

export function filterByPeriod(
  records: DashboardAuditRecord[],
  period: DashboardPeriod,
  now = new Date()
): DashboardAuditRecord[] {
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);

  return records.filter((record) => {
    const date = recordMetricDate(record);
    if (period === "today") return isSameDay(date, today);
    if (period === "yesterday") return isSameDay(date, yesterday);
    if (period === "week") {
      const weekStart = startOfWeekMonday(now);
      const weekEnd = addDays(weekStart, 7);
      return date >= weekStart && date < weekEnd;
    }
    if (period === "month") return isSameMonth(date, now);
    return true;
  });
}

export function filterCurrentMonth(
  records: DashboardAuditRecord[],
  now = new Date()
): DashboardAuditRecord[] {
  return records.filter((r) => isSameMonth(recordMetricDate(r), now));
}

/** Filter by an explicit from/to date range (both YYYY-MM-DD, both optional). */
export function filterByCustomRange(
  records: DashboardAuditRecord[],
  from: string,
  to: string
): DashboardAuditRecord[] {
  if (!from && !to) return records;
  return records.filter((r) => {
    const date = recordMetricDate(r);
    if (from) {
      const [fy, fm, fd] = from.split("-").map(Number);
      if (date < new Date(fy, fm - 1, fd)) return false;
    }
    if (to) {
      const [ty, tm, td] = to.split("-").map(Number);
      const end = new Date(ty, tm - 1, td);
      end.setDate(end.getDate() + 1); // inclusive end
      if (date >= end) return false;
    }
    return true;
  });
}

function finalScore(record: DashboardAuditRecord): number {
  return record.finalPct ?? (record.hasFatal ? 0 : record.qualityPct);
}

export function computePeriodStats(records: DashboardAuditRecord[]) {
  const total = records.length;
  const fatals = records.filter((r) => r.hasFatal).length;
  const uniqueAgents = new Set(records.map((r) => r.agent)).size;

  const avgQualityExclFatal =
    total > 0
      ? Math.round(
          records.reduce((sum, r) => sum + r.qualityPct, 0) / total
        )
      : 0;

  const avgFinalInclFatal =
    total > 0
      ? Math.round(
          records.reduce((sum, r) => sum + finalScore(r), 0) / total
        )
      : 0;

  const passCount = records.filter(
    (r) => !r.hasFatal && r.qualityPct >= PASS_RATE_QUALITY_THRESHOLD
  ).length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  const fatalRate = total > 0 ? Math.round((fatals / total) * 100) : 0;

  const excellentCount = records.filter(
    (r) => !r.hasFatal && r.qualityPct >= 90
  ).length;

  return {
    total,
    avgQualityExclFatal,
    passRate,
    avgFinalInclFatal,
    fatals,
    fatalRate,
    uniqueAgents,
    excellentCount,
  };
}

export function computeScoreDistribution(
  records: DashboardAuditRecord[]
): ScoreBucket[] {
  const total = records.length;
  const buckets = [
    {
      key: "excellent" as const,
      label: "Excellent",
      range: "≥95%",
      count: 0,
    },
    {
      key: "good" as const,
      label: "Good",
      range: "90–94%",
      count: 0,
    },
    {
      key: "average" as const,
      label: "Average",
      range: "75–89%",
      count: 0,
    },
    {
      key: "poor" as const,
      label: "Poor",
      range: "<75%",
      count: 0,
    },
  ];

  for (const record of records) {
    if (record.hasFatal) continue;
    const q = record.qualityPct;
    if (q >= 95) buckets[0].count++;
    else if (q >= 90) buckets[1].count++;
    else if (q >= 75) buckets[2].count++;
    else buckets[3].count++;
  }

  const scoredTotal = buckets.reduce((sum, b) => sum + b.count, 0);

  return buckets.map((b) => ({
    ...b,
    pct:
      scoredTotal > 0 ? Math.round((b.count / scoredTotal) * 100) : 0,
  }));
}

function averageQualityPct(records: DashboardAuditRecord[]): number {
  if (records.length === 0) return 0;
  return Math.round(
    records.reduce((sum, record) => sum + record.qualityPct, 0) / records.length
  );
}

function recordsInRange(
  records: DashboardAuditRecord[],
  start: Date,
  end: Date
): DashboardAuditRecord[] {
  return records.filter((record) => {
    const date = recordMetricDate(record);
    return date >= start && date < end;
  });
}

export function resolveTrendRangeBounds(
  input: TrendRangeInput,
  now = new Date()
): TrendRangeBounds | null {
  if (input.customFrom || input.customTo) {
    const start = input.customFrom
      ? parseMetricDate(input.customFrom)
      : addDays(parseMetricDate(input.customTo || input.customFrom), -90);
    const end = input.customTo
      ? addDays(parseMetricDate(input.customTo), 1)
      : addDays(startOfDay(now), 1);
    return { start, end };
  }

  const today = startOfDay(now);
  if (input.period === "overall") return null;
  if (input.period === "today") {
    return { start: today, end: addDays(today, 1) };
  }
  if (input.period === "yesterday") {
    const yesterday = addDays(today, -1);
    return { start: yesterday, end: today };
  }
  if (input.period === "week") {
    const weekStart = startOfWeekMonday(now);
    return { start: weekStart, end: addDays(weekStart, 7) };
  }
  if (input.period === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  return null;
}

function buildTrendBucketsInRange(
  records: DashboardAuditRecord[],
  granularity: TrendGranularity,
  bounds: TrendRangeBounds
): TrendPoint[] {
  const points: TrendPoint[] = [];

  if (granularity === "day") {
    let cursor = startOfDay(bounds.start);
    while (cursor < bounds.end && points.length < 31) {
      const next = addDays(cursor, 1);
      const bucket = recordsInRange(records, cursor, next);
      points.push({
        id: `d-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
        name: formatDayLabel(cursor),
        score: averageQualityPct(bucket),
        count: bucket.length,
      });
      cursor = next;
    }
    return points;
  }

  if (granularity === "week") {
    let cursor = startOfWeekMonday(bounds.start);
    while (cursor < bounds.end && points.length < 12) {
      const next = addDays(cursor, 7);
      const bucket = recordsInRange(records, cursor, next);
      points.push({
        id: `w-${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
        name: formatWeekLabel(cursor),
        score: averageQualityPct(bucket),
        count: bucket.length,
      });
      cursor = next;
    }
    return points;
  }

  let cursor = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
  const endMonth = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
  while (cursor <= endMonth && points.length < 12) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const bucket = records.filter((record) =>
      isSameMonth(recordMetricDate(record), cursor)
    );
    points.push({
      id: `m-${cursor.getFullYear()}-${cursor.getMonth()}`,
      name: formatMonthLabel(cursor),
      score: averageQualityPct(bucket),
      count: bucket.length,
    });
    cursor = next;
  }

  return points;
}

export function computeTrendData(
  records: DashboardAuditRecord[],
  granularity: TrendGranularity,
  now = new Date(),
  bounds?: TrendRangeBounds | null
): TrendPoint[] {
  if (bounds) {
    return buildTrendBucketsInRange(records, granularity, bounds);
  }

  if (granularity === "month") {
    return Array.from({ length: 6 }).map((_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const filtered = records.filter((r) =>
        isSameMonth(recordMetricDate(r), date)
      );
      return {
        id: `m-${date.getFullYear()}-${date.getMonth()}`,
        name: formatMonthLabel(date),
        score: averageQualityPct(filtered),
        count: filtered.length,
      };
    });
  }

  if (granularity === "week") {
    return Array.from({ length: 8 }).map((_, i) => {
      const anchor = addDays(now, -7 * (7 - i));
      const weekStart = startOfWeekMonday(anchor);
      const weekEnd = addDays(weekStart, 7);
      const filtered = recordsInRange(records, weekStart, weekEnd);
      return {
        id: `w-${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`,
        name: formatWeekLabel(weekStart),
        score: averageQualityPct(filtered),
        count: filtered.length,
      };
    });
  }

  return Array.from({ length: 14 }).map((_, i) => {
    const date = addDays(now, -(13 - i));
    const dayStart = startOfDay(date);
    const filtered = recordsInRange(records, dayStart, addDays(dayStart, 1));
    return {
      id: `d-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      name: formatDayLabel(date),
      score: averageQualityPct(filtered),
      count: filtered.length,
    };
  });
}

export function computeAgentTargets(
  allRecords: DashboardAuditRecord[],
  monthRecords: DashboardAuditRecord[],
  targetPerAgent: number
): {
  agents: AgentTargetRow[];
  cumulativeAchieved: number;
  cumulativeTarget: number;
  cumulativePct: number;
} {
  const agentNames = Array.from(
    new Set(allRecords.map((r) => r.agent))
  ).sort((a, b) => a.localeCompare(b));

  const monthByAgent = monthRecords.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.agent] = (acc[r.agent] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const agents = agentNames.map((name) => {
    const achieved = monthByAgent[name] ?? 0;
    const pct =
      targetPerAgent > 0
        ? Math.round((achieved / targetPerAgent) * 100)
        : 0;
    return { name, achieved, target: targetPerAgent, pct };
  });

  const cumulativeAchieved = monthRecords.length;
  const cumulativeTarget = agentNames.length * targetPerAgent;
  const cumulativePct =
    cumulativeTarget > 0
      ? Math.round((cumulativeAchieved / cumulativeTarget) * 100)
      : 0;

  return {
    agents,
    cumulativeAchieved,
    cumulativeTarget,
    cumulativePct,
  };
}

export function computeAuditorTargets(
  allRecords: DashboardAuditRecord[],
  monthRecords: DashboardAuditRecord[],
  totalMonthlyTarget: number
): {
  auditors: AuditorTargetRow[];
  perAuditorTarget: number;
  activeAuditors: number;
} {
  const auditorNames = Array.from(
    new Set(
      allRecords
        .map((r) => r.auditor)
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b));

  const activeAuditors = auditorNames.length || 1;
  const perAuditorTarget = Math.ceil(totalMonthlyTarget / activeAuditors);

  const monthByAuditor = monthRecords.reduce<Record<string, number>>(
    (acc, r) => {
      if (!r.auditor) return acc;
      acc[r.auditor] = (acc[r.auditor] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const auditors = auditorNames.map((name) => {
    const achieved = monthByAuditor[name] ?? 0;
    const pct =
      perAuditorTarget > 0
        ? Math.round((achieved / perAuditorTarget) * 100)
        : 0;
    return { name, achieved, target: perAuditorTarget, pct };
  });

  return { auditors, perAuditorTarget, activeAuditors };
}

export function auditorInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function computeTopAgents(records: DashboardAuditRecord[]): TopAgentRow[] {
  const byAgent: Record<string, { sum: number; cnt: number }> = {};

  for (const record of records) {
    if (!byAgent[record.agent]) {
      byAgent[record.agent] = { sum: 0, cnt: 0 };
    }
    byAgent[record.agent].sum += record.qualityPct;
    byAgent[record.agent].cnt += 1;
  }

  return Object.entries(byAgent)
    .map(([name, data]) => ({
      name,
      avg: data.cnt > 0 ? Math.round(data.sum / data.cnt) : 0,
      count: data.cnt,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);
}

export function computeTopFatals(records: DashboardAuditRecord[]): TopFatalRow[] {
  const errorMap: Record<string, number> = {};

  for (const record of records) {
    for (const err of record.fatalList) {
      errorMap[err] = (errorMap[err] ?? 0) + 1;
    }
  }

  return Object.entries(errorMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function getFatalOccurrences(
  records: DashboardAuditRecord[],
  fatalName: string
): FatalOccurrenceRow[] {
  return records
    .filter((record) => record.fatalList.includes(fatalName))
    .map((record) => ({
      id: record.id,
      auditCode: record.auditCode,
      agent: record.agent,
      supervisor: record.supervisor,
      auditor: record.auditor,
      lob: record.lob,
      type: record.type,
      callDate: record.callDate,
      auditDate: record.auditDate,
      qualityPct: record.qualityPct,
      finalPct: record.finalPct,
    }))
    .sort((a, b) => {
      const dateA = resolveMetricDate(a.auditDate, a.callDate);
      const dateB = resolveMetricDate(b.auditDate, b.callDate);
      return dateB.localeCompare(dateA);
    });
}
