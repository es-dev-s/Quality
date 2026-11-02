import { getUsersPage } from "@/lib/actions/admin";
import { getAgentTransferHistory } from "@/lib/actions/agent-transfer";
import { getAgentsPage } from "@/lib/actions/agents";
import { getAnalyticsData } from "@/lib/actions/analytics";
import { getDashboardPageData } from "@/lib/actions/dashboard";
import { getKpiPageData } from "@/lib/actions/kpi";
import { getReportData,getReportExportData } from "@/lib/actions/reports";
import { isAuthSessionError } from "@/lib/auth-errors";
import { ForbiddenError } from "@/lib/auth-guards";
import { buildAuditExportCsv } from "@/lib/reports/export-csv";
import { reportFiltersSchema } from "@/lib/validation/reports";
import { ZodError } from "zod";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const raw = params.get("query") ?? "{}";
    if (raw.length > 16_000) return Response.json({ error: "Invalid query." }, { status: 400 });
    const query = JSON.parse(raw);
    if (!query || typeof query !== "object" || Array.isArray(query)) return Response.json({ error: "Invalid query." }, { status: 400, headers });
    const refresh = (params.get("refresh") ?? "").slice(0, 30);
    let data: unknown;
    switch (params.get("view")) {
      case "dashboard": data = await getDashboardPageData(query, refresh); break;
      case "analytics": data = await getAnalyticsData(query, refresh); break;
      case "kpi": data = await getKpiPageData(query, refresh); break;
      case "reports": data = await getReportData(reportFiltersSchema.parse(query.filters), query); break;
      case "users": data = await getUsersPage(query); break;
      case "agents": data = await getAgentsPage(query); break;
      case "transfers": data = await getAgentTransferHistory(query); break;
      case "report-export": {
        const result = await getReportExportData(reportFiltersSchema.parse(query.filters));
        if (result.error) return Response.json({ error: result.error }, { status: 403, headers });
        return new Response(buildAuditExportCsv(result.rows), { headers: { ...headers, "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": `attachment; filename="quality-report-${Date.now()}.csv"` } });
      }
      default: return Response.json({ error: "Unknown view." }, { status: 400, headers });
    }
    return Response.json(data, { headers });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid filters or pagination." }, { status: 400, headers });
    if (error instanceof ForbiddenError || (error instanceof Error && error.message === "Forbidden")) return Response.json({ error: "Forbidden." }, { status: 403, headers });
    if (isAuthSessionError(error)) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401, headers });
    console.error("[workspace-data] Read failed:", error);
    return Response.json({ error: "Could not load data. Please try again." }, { status: 500, headers });
  }
}
