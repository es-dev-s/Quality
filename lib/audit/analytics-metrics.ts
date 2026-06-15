import { PASS_RATE_QUALITY_THRESHOLD } from "@/lib/audit/metrics-config";
import { resolveMetricDate } from "@/lib/audit/metric-dates";
import type { AuditRow } from "@/lib/audit/types";

export type AnalyticsAuditRecord = {
  id: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  type: string;
  callDate: string;
  auditDate: string;
  qualityPct: number;
  finalPct: number;
  hasFatal: boolean;
  feedbackStatus: string;
  rows: AuditRow[];
};

export type QmsParameterStat = {
  name: string;
  score: number;
  max: number;
  avg: number;
};

export type QmsTeamStat = {
  team: string;
  avg: number;
  count: number;
};

export type QmsAgentStat = {
  agent: string;
  avg: number;
  count: number;
};

export type QmsAuditorStat = {
  name: string;
  count: number;
  avg: number;
  passRate: number;
};

export type QmsKpis = {
  total_audits: number;
  overall_avg: number;
  fatal_count: number;
  critical_count: number;
  medium_count: number;
  low_count: number;
  call_score: number;
  chat_score: number;
  call_count: number;
  chat_count: number;
  fb_done: number;
  fb_pending: number;
  week1: number;
  week2: number;
  below_80: number;
  btw_80_90: number;
  btw_90_95: number;
  above_95: number;
};

export type QmsAnalyticsData = {
  kpis: QmsKpis;
  params: QmsParameterStat[];
  teams: QmsTeamStat[];
  bottom_agents: QmsAgentStat[];
  top_agents: QmsAgentStat[];
  auditors: QmsAuditorStat[];
  fatal_by_team: { team: string; count: number }[];
};

const MIN_AGENT_AUDITS = 3;

export function scoreColorClass(score: number): string {
  if (score >= 95) return "qms-tone--excellent";
  if (score >= 90) return "qms-tone--good";
  if (score >= 80) return "qms-tone--fair";
  return "qms-tone--critical";
}

export function summaryChipClass(score: number): string {
  if (score >= 95) return "qms-summary-chip--excellent";
  if (score >= 90) return "qms-summary-chip--good";
  if (score >= 80) return "qms-summary-chip--fair";
  return "qms-summary-chip--critical";
}

export function scoreStatusLabel(score: number): string {
  if (score >= 95) return "Excellent";
  if (score >= 90) return "Good";
  if (score >= 80) return "Fair";
  return "Critical";
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseMetricDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function recordMetricDate(record: AnalyticsAuditRecord): Date {
  return parseMetricDate(
    resolveMetricDate(record.auditDate, record.callDate)
  );
}

function computeParameterStats(records: AnalyticsAuditRecord[]): QmsParameterStat[] {
  const byName = new Map<
    string,
    { scoreSum: number; maxSum: number; count: number }
  >();

  for (const record of records) {
    for (const row of record.rows) {
      if (row.sel === "NA" || row.max <= 0) continue;
      const entry = byName.get(row.name) ?? {
        scoreSum: 0,
        maxSum: 0,
        count: 0,
      };
      entry.scoreSum += row.score;
      entry.maxSum += row.max;
      entry.count += 1;
      byName.set(row.name, entry);
    }
  }

  return Array.from(byName.entries())
    .map(([name, data]) => {
      const score =
        data.maxSum > 0
          ? round1((data.scoreSum / data.maxSum) * 100)
          : 0;
      const avgRaw =
        data.count > 0 ? round1(data.scoreSum / data.count) : 0;
      const maxTypical =
        data.count > 0 ? round1(data.maxSum / data.count) : 0;
      return {
        name,
        score,
        max: maxTypical,
        avg: avgRaw,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function computeAgentStats(records: AnalyticsAuditRecord[]): QmsAgentStat[] {
  const byAgent = new Map<string, number[]>();

  for (const record of records) {
    const list = byAgent.get(record.agent) ?? [];
    list.push(record.qualityPct);
    byAgent.set(record.agent, list);
  }

  return Array.from(byAgent.entries())
    .map(([agent, scores]) => ({
      agent,
      avg: round1(avg(scores)),
      count: scores.length,
    }))
    .filter((a) => a.count >= MIN_AGENT_AUDITS);
}

function computeTeamStats(records: AnalyticsAuditRecord[]): QmsTeamStat[] {
  const byTeam = new Map<string, number[]>();

  for (const record of records) {
    const team = record.supervisor?.trim() || "Unassigned";
    const list = byTeam.get(team) ?? [];
    list.push(record.qualityPct);
    byTeam.set(team, list);
  }

  return Array.from(byTeam.entries())
    .map(([team, scores]) => ({
      team,
      avg: round1(avg(scores)),
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

function computeAuditorStats(records: AnalyticsAuditRecord[]): QmsAuditorStat[] {
  const byAuditor = new Map<string, { scores: number[]; pass: number }>();

  for (const record of records) {
    if (!record.auditor) continue;
    const entry = byAuditor.get(record.auditor) ?? { scores: [], pass: 0 };
    entry.scores.push(record.qualityPct);
    if (!record.hasFatal && record.qualityPct >= PASS_RATE_QUALITY_THRESHOLD) {
      entry.pass += 1;
    }
    byAuditor.set(record.auditor, entry);
  }

  return Array.from(byAuditor.entries())
    .map(([name, data]) => ({
      name,
      count: data.scores.length,
      avg: round1(avg(data.scores)),
      passRate:
        data.scores.length > 0
          ? Math.round((data.pass / data.scores.length) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function computeFatalByTeam(
  records: AnalyticsAuditRecord[]
): { team: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    if (!record.hasFatal) continue;
    const team = record.supervisor?.trim() || "Unassigned";
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count);
}

function computeAgentBands(agentStats: QmsAgentStat[]) {
  return {
    below_80: agentStats.filter((a) => a.avg < 80).length,
    btw_80_90: agentStats.filter((a) => a.avg >= 80 && a.avg < 90).length,
    btw_90_95: agentStats.filter((a) => a.avg >= 90 && a.avg < 95).length,
    above_95: agentStats.filter((a) => a.avg >= 95).length,
  };
}

function computeWeekSplit(records: AnalyticsAuditRecord[], now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  let week1 = 0;
  let week2 = 0;

  for (const record of records) {
    const date = recordMetricDate(record);
    if (date.getMonth() !== month || date.getFullYear() !== year) continue;
    if (date.getDate() <= 15) week1++;
    else week2++;
  }

  return { week1, week2 };
}

export function computeQmsAnalytics(
  records: AnalyticsAuditRecord[],
  now = new Date()
): QmsAnalyticsData {
  const total = records.length;
  const overallAvg = total > 0 ? round1(avg(records.map((r) => r.qualityPct))) : 0;

  const callRecords = records.filter((r) => r.type === "Call");
  const chatRecords = records.filter((r) => r.type === "Chat");

  const fatalCount = records.filter((r) => r.hasFatal).length;
  const criticalCount = records.filter(
    (r) => !r.hasFatal && r.qualityPct < 60
  ).length;
  const mediumCount = records.filter(
    (r) => !r.hasFatal && r.qualityPct >= 60 && r.qualityPct < 80
  ).length;
  const lowCount = records.filter(
    (r) => !r.hasFatal && r.qualityPct >= 80
  ).length;

  const fbDone = records.filter(
    (r) =>
      r.feedbackStatus === "Shared" ||
      r.feedbackStatus === "Acknowledged"
  ).length;
  const fbPending = records.filter(
    (r) => r.feedbackStatus === "Pending" || r.feedbackStatus === "Disputed"
  ).length;

  const agentStats = computeAgentStats(records);
  const bands = computeAgentBands(agentStats);
  const weekSplit = computeWeekSplit(records, now);

  const teams = computeTeamStats(records);
  const sortedAgentsAsc = [...agentStats].sort((a, b) => a.avg - b.avg);
  const sortedAgentsDesc = [...agentStats].sort((a, b) => b.avg - a.avg);

  return {
    kpis: {
      total_audits: total,
      overall_avg: overallAvg,
      fatal_count: fatalCount,
      critical_count: criticalCount,
      medium_count: mediumCount,
      low_count: lowCount,
      call_score:
        callRecords.length > 0
          ? round1(avg(callRecords.map((r) => r.qualityPct)))
          : 0,
      chat_score:
        chatRecords.length > 0
          ? round1(avg(chatRecords.map((r) => r.qualityPct)))
          : 0,
      call_count: callRecords.length,
      chat_count: chatRecords.length,
      fb_done: fbDone,
      fb_pending: fbPending,
      week1: weekSplit.week1,
      week2: weekSplit.week2,
      ...bands,
    },
    params: computeParameterStats(records),
    teams,
    bottom_agents: sortedAgentsAsc.slice(0, 10),
    top_agents: sortedAgentsDesc.slice(0, 10),
    auditors: computeAuditorStats(records),
    fatal_by_team: computeFatalByTeam(records),
  };
}
