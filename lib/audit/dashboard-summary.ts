import { z } from "zod";
import type { DashboardAuditData } from "@/lib/audit/audit-records";
import { defaultAuditHistoryFilter, filterByAuditHistory } from "@/lib/audit/history-filter";
import { computeAgentTargets, computeAuditorTargets, computePeriodStats, computeScoreDistribution, computeTopAgents, computeTopFatals, computeTrendData, excludeDeactivatedAgentRecords, extractFilterOptions, filterByCustomRange, filterByIncludeFilters, filterByPeriod, filterCurrentMonth, filterRecordsByAuditSource, getFatalOccurrences, mergeRosterIntoFilterOptions, resolveTrendRangeBounds, restrictAuditorTargetsToViewer } from "@/lib/audit/dashboard-metrics";
import { serverPageSchema, pageItems } from "@/lib/server/page-query";

const text = z.string().trim().max(200).default("");
const date = z.union([z.literal(""), z.iso.date()]);
const range = z.object({ from: date.default(""), to: date.default("") }).default({ from: "", to: "" });
export const dashboardQuerySchema = z.object({
  period: z.enum(["overall", "today", "yesterday", "week", "month", "custom"]).default("overall"),
  customRange: range,
  includeFilters: z.object({ agent: text, teamName: text, businessType: text, auditor: text, auditType: text, auditSource: z.enum(["", "supervisor", "qa", "other"]).default("") }).default({ agent: "", teamName: "", businessType: "", auditor: "", auditType: "", auditSource: "" }),
  historyFilter: z.enum(["working", "history", "all"]).optional(),
  trendGranularity: z.enum(["day", "week", "month"]).default("week"),
  targetAuditSource: z.enum(["", "supervisor", "qa", "other"]).default(""),
  agentTarget: z.number().min(1).max(999).optional(),
  totalMonthlyTarget: z.number().min(1).max(99999).nullable().optional(),
  auditorTargetRange: range,
  selectedFatal: z.string().max(200).nullable().default(null),
  agentPage: serverPageSchema.shape.page,
  auditorPage: serverPageSchema.shape.page,
  fatalPage: serverPageSchema.shape.page,
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export function buildDashboardSummary(data: DashboardAuditData, query: DashboardQuery, viewer: { id: string; roleSlug: string; name?: string | null; email?: string | null }) {
  const records = data.records;
  const now = new Date(data.fetchedAt);
  const defaultHistory = defaultAuditHistoryFilter(records, viewer.id, viewer.roleSlug, "metrics");
  const history = viewer.roleSlug === "agent" ? "working" : query.historyFilter ?? defaultHistory;
  const scoped = filterByIncludeFilters(filterByAuditHistory(records, history), query.includeFilters);
  const filtered = query.customRange.from || query.customRange.to ? filterByCustomRange(scoped, query.customRange.from, query.customRange.to) : filterByPeriod(scoped, query.period, now);
  const month = filterCurrentMonth(scoped, now);
  const allTargets = excludeDeactivatedAgentRecords(scoped, data.deactivatedAgentNames);
  const monthTargets = excludeDeactivatedAgentRecords(month, data.deactivatedAgentNames);
  const effectiveSource = query.includeFilters.auditSource || query.targetAuditSource;
  const agentTarget = query.agentTarget ?? data.agentTarget;
  const agentTargets = computeAgentTargets(allTargets, filterRecordsByAuditSource(monthTargets, effectiveSource), agentTarget);
  const resolvedMonthlyTarget = query.totalMonthlyTarget ?? data.totalMonthlyTarget ?? agentTargets.cumulativeTarget;
  const auditorRange = query.auditorTargetRange.from || query.auditorTargetRange.to ? filterByCustomRange(scoped, query.auditorTargetRange.from, query.auditorTargetRange.to) : null;
  let auditorTargets = computeAuditorTargets(auditorRange ?? scoped, auditorRange ?? month, resolvedMonthlyTarget);
  if (viewer.roleSlug === "quality-analyst") auditorTargets = restrictAuditorTargetsToViewer(auditorTargets, viewer);
  const counts = { "": monthTargets.length, supervisor: 0, qa: 0, other: 0 };
  for (const record of monthTargets) counts[record.auditSource ?? "other"]++;
  const bounds = resolveTrendRangeBounds({ period: query.customRange.from || query.customRange.to ? "custom" : query.period, customFrom: query.customRange.from, customTo: query.customRange.to }, now);
  return {
    defaultHistoryFilter: defaultHistory, hasHistory: records.some((row) => row.isHistory),
    filterOptions: mergeRosterIntoFilterOptions(extractFilterOptions(records), data.rosterAgentNames),
    recordCount: records.length, filteredCount: filtered.length,
    stats: computePeriodStats(filtered), monthStats: computePeriodStats(month),
    distribution: computeScoreDistribution(filtered), trendData: computeTrendData(filtered, query.trendGranularity, now, bounds),
    agentTargets, auditorTargets, agentTargetSourceCounts: counts, resolvedMonthlyTarget,
    topAgents: computeTopAgents(filtered), topFatals: computeTopFatals(filtered),
    recentSubmissions: [...filtered].sort((a, b) => b.auditDate.localeCompare(a.auditDate)).slice(0, 5),
    fatalOccurrences: query.selectedFatal ? getFatalOccurrences(filtered, query.selectedFatal) : [],
    fetchedAt: data.fetchedAt, dbError: data.dbError, agentTarget: data.agentTarget, totalMonthlyTarget: data.totalMonthlyTarget,
  };
}

export function paginateDashboardSummary(summary: ReturnType<typeof buildDashboardSummary>, query: DashboardQuery) {
  const agents = pageItems(summary.agentTargets.agents, { page: query.agentPage, pageSize: 20 });
  const auditors = pageItems(summary.auditorTargets.auditors, { page: query.auditorPage, pageSize: 20 });
  const fatals = pageItems(summary.fatalOccurrences, { page: query.fatalPage, pageSize: 20 });
  return { ...summary, agentTargets: { ...summary.agentTargets, agents: agents.rows }, auditorTargets: { ...summary.auditorTargets, auditors: auditors.rows }, fatalOccurrences: fatals.rows, agentPagination: agents.pagination, auditorPagination: auditors.pagination, fatalPagination: fatals.pagination };
}
export type DashboardSummary = ReturnType<typeof paginateDashboardSummary>;
