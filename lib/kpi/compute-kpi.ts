import {
  matchesCustomDateRange,
  matchesDateRange,
} from "@/lib/audit/date-filters";
import {
  agentNameInVisibleSet,
  normalizeAgentDisplayName,
} from "@/lib/audit/agent-name-match";
import { qualityPctForAverage } from "@/lib/audit/metrics-config";
import { resolveMetricDate } from "@/lib/audit/metric-dates";
import { KPI_COLUMNS, type KpiColumn, type KpiRow } from "@/lib/kpi/columns";
import type { KpiFiltersState } from "@/lib/kpi/filters";
import { KPI_DEFAULT_AGENT_TARGET, type KpiAuditRecord } from "@/lib/kpi/records";

const UNAVAILABLE = "—";
const CALIBRATION_AUDIT = "Calibration Audit";

export type KpiTableRow = KpiRow & {
  agent: string;
  supervisor: string;
};

function metricDate(record: KpiAuditRecord): string {
  return resolveMetricDate(record.auditDate, record.callDate);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = avg(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function formatPct(numerator: number, denominator: number): string {
  if (denominator <= 0) return UNAVAILABLE;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatRatioPct(achieved: number, target: number): string {
  if (target <= 0) return String(achieved);
  const pct = Math.round((achieved / target) * 100);
  return `${achieved}/${target} (${pct}%)`;
}

function formatCountRate(count: number, total: number): string {
  if (total <= 0) return UNAVAILABLE;
  return `${count}/${total} (${Math.round((count / total) * 100)}%)`;
}

function weekSplitLabel(records: KpiAuditRecord[]): string | null {
  let week1 = 0;
  let week2 = 0;
  for (const record of records) {
    const raw = metricDate(record);
    if (!raw) continue;
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) continue;
    if (d <= 15) week1 += 1;
    else week2 += 1;
  }
  if (week1 + week2 === 0) return null;
  return `W1 ${week1} · W2 ${week2}`;
}

function namesMatch(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  return normalizeAgentDisplayName(a) === normalizeAgentDisplayName(b);
}

/** Prorate dashboard monthly agent target for the active time preset. */
export function resolvePeriodTarget(
  targetPerAgent: number,
  time: KpiFiltersState["time"]
): number {
  if (targetPerAgent <= 0) return 0;
  switch (time) {
    case "today":
      return Math.max(1, Math.round(targetPerAgent / 30));
    case "week":
      return Math.max(1, Math.round(targetPerAgent / 4));
    case "month":
      return targetPerAgent;
    case "3m":
      return targetPerAgent * 3;
    case "6m":
      return targetPerAgent * 6;
    case "custom":
      return targetPerAgent;
    default:
      return targetPerAgent;
  }
}

export function filterKpiRecords(
  records: KpiAuditRecord[],
  filters: KpiFiltersState,
  qmAgentNames?: string[] | null
): KpiAuditRecord[] {
  return records.filter((record) => {
    if (record.isHistory) return false;

    if (filters.qm) {
      const roster = qmAgentNames ?? [];
      if (roster.length === 0) return false;
      if (!agentNameInVisibleSet(record.agent, roster)) return false;
    }

    if (filters.qa && !namesMatch(record.auditor, filters.qa)) return false;

    const date = metricDate(record);
    if (!date) return false;

    if (filters.time === "custom") {
      return matchesCustomDateRange(date, filters.customFrom, filters.customTo);
    }

    return matchesDateRange(date, filters.time);
  });
}

function feedbackDone(status: string): boolean {
  return status === "Shared" || status === "Acknowledged";
}

function computeMetricValues(
  records: KpiAuditRecord[],
  options: {
    target: number;
    rosterSize: number;
    uniqueAgentsAudited: number;
    time: KpiFiltersState["time"];
    coverageMode: "overall" | "agent";
  }
): Partial<Record<KpiColumn, string | number | null>> {
  const total = records.length;
  const values: Partial<Record<KpiColumn, string | number | null>> = {};

  for (const column of KPI_COLUMNS) {
    values[column] = UNAVAILABLE;
  }

  values["Audit Frequency"] = formatRatioPct(total, options.target);

  if (options.coverageMode === "overall") {
    if (options.rosterSize > 0) {
      values["Audit Coverage"] = formatPct(
        options.uniqueAgentsAudited,
        options.rosterSize
      );
    } else if (total > 0) {
      values["Audit Coverage"] = formatPct(options.uniqueAgentsAudited, 1);
    }
    if (options.time === "month") {
      const split = weekSplitLabel(records);
      if (split) {
        values["Audit Coverage"] =
          values["Audit Coverage"] === UNAVAILABLE
            ? split
            : `${values["Audit Coverage"]} · ${split}`;
      }
    }
  } else if (total > 0) {
    const split =
      options.time === "month" ? weekSplitLabel(records) : null;
    values["Audit Coverage"] = split ?? "Covered";
  } else {
    values["Audit Coverage"] = "Not covered";
  }

  if (total > 0) {
    const callRecords = records.filter((r) => r.type === "Call");
    const iqaSource = callRecords.length > 0 ? callRecords : records;
    values["Call Quality Score (IQA)"] = `${round1(
      avg(iqaSource.map(qualityPctForAverage))
    )}%`;

    const disputed = records.filter(
      (r) => r.feedbackStatus === "Disputed"
    ).length;
    values.Rebuttal = formatCountRate(disputed, total);

    const done = records.filter((r) => feedbackDone(r.feedbackStatus)).length;
    values["Feedback Coverage"] = formatCountRate(done, total);

    const calibration = records.filter(
      (r) => r.auditType === CALIBRATION_AUDIT
    );
    if (calibration.length > 0) {
      const scores = calibration.map(qualityPctForAverage);
      const spread = stddev(scores);
      const mean = round1(avg(scores));
      values["Calibration Variance"] =
        spread === null
          ? `${calibration.length} · avg ${mean}%`
          : `${calibration.length} · σ ${round1(spread)} (avg ${mean}%)`;
    }

    const callCount = callRecords.length;
    values["Call Taking"] = `${callCount} call · ${total - callCount} chat`;
  }

  values["Hygiene Audit"] = UNAVAILABLE;
  values["Audit DipCheck (RTR)"] = UNAVAILABLE;
  values["Project Initiatives"] = UNAVAILABLE;
  values["Team Attrition"] = UNAVAILABLE;

  return values;
}

function agentsInScope(filtered: KpiAuditRecord[]): string[] {
  return Array.from(
    new Set(filtered.map((r) => r.agent).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export type ComputeKpiRowsOptions = {
  records: KpiAuditRecord[];
  filters: KpiFiltersState;
  /** Global roster (superadmin) used when no QM is selected. */
  rosterAgentNames: string[];
  targetPerAgent: number;
  /** QM display name → agent names on that QM's roster. */
  qmAgentNamesByQm?: Record<string, string[]>;
};

/**
 * Builds workbook rows: overall summary first, then one row per agent in scope.
 * QM filter scopes audits to that manager's roster (approved / assigned agents).
 */
export function computeKpiRows(
  recordsOrOptions: KpiAuditRecord[] | ComputeKpiRowsOptions,
  filtersArg?: KpiFiltersState,
  rosterAgentNamesArg?: string[],
  targetPerAgentArg?: number,
  qmAgentNamesByQmArg?: Record<string, string[]>
): KpiTableRow[] {
  const options: ComputeKpiRowsOptions = Array.isArray(recordsOrOptions)
    ? {
        records: recordsOrOptions,
        filters: filtersArg!,
        rosterAgentNames: rosterAgentNamesArg ?? [],
        targetPerAgent: targetPerAgentArg ?? KPI_DEFAULT_AGENT_TARGET,
        qmAgentNamesByQm: qmAgentNamesByQmArg,
      }
    : recordsOrOptions;

  const {
    records,
    filters,
    rosterAgentNames,
    targetPerAgent,
    qmAgentNamesByQm = {},
  } = options;

  const qmRoster = filters.qm
    ? (qmAgentNamesByQm[filters.qm] ?? [])
    : null;

  const filtered = filterKpiRecords(records, filters, qmRoster);
  const periodTarget = resolvePeriodTarget(targetPerAgent, filters.time);
  const agents = agentsInScope(filtered);
  const uniqueAgentsAudited = agents.length;

  // Coverage denominator: QM roster when selected, otherwise full platform roster.
  const effectiveRoster =
    qmRoster !== null
      ? qmRoster
      : rosterAgentNames.length > 0
        ? rosterAgentNames
        : agents;

  const rosterSize = Math.max(effectiveRoster.length, uniqueAgentsAudited, 1);

  // Frequency target: expected audits for the scoped book of agents.
  const targetAgentCount =
    qmRoster !== null
      ? Math.max(qmRoster.length, 1)
      : Math.max(effectiveRoster.length || agents.length || 1, 1);

  const overallValues = computeMetricValues(filtered, {
    target: targetAgentCount * periodTarget,
    rosterSize,
    uniqueAgentsAudited,
    time: filters.time,
    coverageMode: "overall",
  });

  const scopeLabel = filters.qm
    ? `QM: ${filters.qm}`
    : filters.qa
      ? `QA: ${filters.qa}`
      : "All teams";

  const overall: KpiTableRow = {
    id: "overall",
    agent: filters.qm ? `Portfolio · ${filters.qm}` : "All agents",
    supervisor: scopeLabel,
    values: overallValues,
  };

  const byAgent = new Map<string, KpiAuditRecord[]>();
  for (const record of filtered) {
    const list = byAgent.get(record.agent) ?? [];
    list.push(record);
    byAgent.set(record.agent, list);
  }

  const agentRows: KpiTableRow[] = agents.map((agentName) => {
    const agentRecords = byAgent.get(agentName) ?? [];
    const supervisor =
      agentRecords.find((r) => r.supervisor)?.supervisor?.trim() || "—";

    const values = computeMetricValues(agentRecords, {
      target: periodTarget,
      rosterSize: 1,
      uniqueAgentsAudited: agentRecords.length > 0 ? 1 : 0,
      time: filters.time,
      coverageMode: "agent",
    });

    return {
      id: `agent:${agentName}`,
      agent: agentName,
      supervisor,
      values,
    };
  });

  agentRows.sort((a, b) => a.agent.localeCompare(b.agent));

  return [overall, ...agentRows];
}
