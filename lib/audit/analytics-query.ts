import { z } from "zod";
import { dashboardQuerySchema } from "@/lib/audit/dashboard-summary";
import { serverPageSchema, pageItems } from "@/lib/server/page-query";
import { sortBreakdownRows } from "@/lib/audit/analytics-sort";
import { applyAnalyticsFilters, extractAnalyticsFilterOptions } from "@/lib/audit/analytics-filters";
import { defaultAuditHistoryFilter, filterByAuditHistory } from "@/lib/audit/history-filter";
import { getAnalyticsFatalOccurrences, type AnalyticsAuditRecord } from "@/lib/audit/analytics-metrics";

export const BREAKDOWN_KEYS = ["team_param_breakdown", "team_cat_breakdown", "agent_param_breakdown", "agent_cat_breakdown", "auditor_param_breakdown", "auditor_cat_breakdown"] as const;
export type BreakdownKey = typeof BREAKDOWN_KEYS[number];
export const analyticsQuerySchema = serverPageSchema.extend({
  period: dashboardQuerySchema.shape.period,
  customRange: dashboardQuerySchema.shape.customRange,
  includeFilters: z.object({ agent: z.string().max(200).default(""), teamName: z.string().max(200).default(""), auditor: z.string().max(200).default(""), businessType: z.string().max(200).default(""), auditSource: z.enum(["", "supervisor", "qa", "other"]).default("") }).default({ agent: "", teamName: "", auditor: "", businessType: "", auditSource: "" }),
  interactionFilter: z.enum(["both", "call", "chat"]).default("both"),
  historyFilter: dashboardQuerySchema.shape.historyFilter,
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  table: z.enum(BREAKDOWN_KEYS).optional(),
  fatalTeam: z.string().max(200).nullable().default(null),
  fatalPage: serverPageSchema.shape.page,
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export function buildAnalyticsSummary(source: { records: AnalyticsAuditRecord[]; rosterAgentNames: string[]; fetchedAt: string }, query: AnalyticsQuery, viewer: { id: string; roleSlug: string }) {
  const defaultHistory = defaultAuditHistoryFilter(source.records, viewer.id, viewer.roleSlug, "metrics");
  const history = viewer.roleSlug === "agent" ? "working" : query.historyFilter ?? defaultHistory;
  const view = applyAnalyticsFilters(filterByAuditHistory(source.records, history), { ...query, referenceNow: new Date(source.fetchedAt) });
  const { records, ...analytics } = view;
  return {
    analytics, defaultHistoryFilter: defaultHistory, hasHistory: source.records.some((row) => row.isHistory),
    filterOptions: extractAnalyticsFilterOptions(source.records, source.rosterAgentNames),
    recordCount: source.records.length, filteredCount: view.filteredCount, fetchedAt: source.fetchedAt,
    fatalOccurrences: query.fatalTeam === null ? [] : getAnalyticsFatalOccurrences(records, query.fatalTeam || null),
  };
}

export function paginateAnalyticsSummary(summary: ReturnType<typeof buildAnalyticsSummary>, query: AnalyticsQuery) {
  const analytics = { ...summary.analytics };
  const pagination = {} as Record<BreakdownKey, ReturnType<typeof pageItems>['pagination']>;
  for (const key of BREAKDOWN_KEYS) {
    const page = pageItems(sortBreakdownRows(analytics[key], query.sortOrder), { page: query.table === key ? query.page : 1, pageSize: query.pageSize });
    analytics[key] = page.rows;
    pagination[key] = page.pagination;
  }
  const fatals = pageItems(summary.fatalOccurrences, { page: query.fatalPage, pageSize: 20 });
  return { ...summary, analytics, pagination, fatalOccurrences: fatals.rows, fatalPagination: fatals.pagination };
}
export type AnalyticsSummary = ReturnType<typeof paginateAnalyticsSummary>;
