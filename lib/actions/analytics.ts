"use server";
import { analyticsQuerySchema,buildAnalyticsSummary,paginateAnalyticsSummary } from "@/lib/audit/analytics-query";
import { fetchAnalyticsRecords } from "@/lib/audit/analytics-source";
import { cachedReadResult } from "@/lib/server/read-cache";

import { canFilterByAgent } from "@/lib/audit/agent-filter-access";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import { dataScopeFromSession } from "@/lib/audit/data-scope";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";

/** Loads scoped audit rows for client-side analytics filtering (period + segment). */
async function loadAnalyticsData() {
  const session = await requirePermission(PERMISSIONS.ANALYTICS_READ);
  const ctx = dataScopeFromSession(session);
  const [records, rosterAgentNames] = await Promise.all([
    fetchAnalyticsRecords(await scopedAuditWhere(session)),
    canFilterByAgent(session.user.role.slug)
      ? fetchAgentRosterNames(ctx.userId, ctx.role.slug)
      : Promise.resolve([] as string[]),
  ]);

  return {
    records,
    rosterAgentNames,
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
  };
}

export async function getAnalyticsData(input: unknown = {}, refresh = "") {
  const session = await requirePermission(PERMISSIONS.ANALYTICS_READ);
  const query = analyticsQuerySchema.parse(input);
  const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !["page", "pageSize", "table", "fatalPage", "sortOrder"].includes(key)));
  const scope = await scopedAuditWhere(session);
  const viewer = { id: session.user.id, roleSlug: session.user.role.slug };
  const summary = await cachedReadResult(JSON.stringify(["analytics", viewer, scope, filters, refresh]), async () => buildAnalyticsSummary(await loadAnalyticsData(), query, viewer));
  return paginateAnalyticsSummary(summary, query);
}
export type AnalyticsPageData = Awaited<ReturnType<typeof getAnalyticsData>>;
