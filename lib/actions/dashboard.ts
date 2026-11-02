"use server";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { getDashboardAuditData } from "@/lib/actions/audit";
import { buildDashboardSummary, dashboardQuerySchema, paginateDashboardSummary } from "@/lib/audit/dashboard-summary";
import { cachedReadResult } from "@/lib/server/read-cache";

export async function getDashboardPageData(input: unknown = {}, refresh = "") {
  const session = await requirePermission(PERMISSIONS.OVERVIEW_READ);
  const query = dashboardQuerySchema.parse(input);
  const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !["agentPage", "auditorPage", "fatalPage"].includes(key)));
  const scope = await scopedAuditWhere(session);
  const viewer = { id: session.user.id, roleSlug: session.user.role.slug, name: session.user.name, email: session.user.email };
  const summary = await cachedReadResult(JSON.stringify(["dashboard", viewer, scope, filters, refresh]), async () => buildDashboardSummary(await getDashboardAuditData(), query, viewer));
  return paginateDashboardSummary(summary, query);
}
