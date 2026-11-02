import { getAuditLogExportData } from "@/lib/actions/audit";
import { auditLogQuerySchema } from "@/lib/audit/log-query";
import { isAuthSessionError } from "@/lib/auth-errors";
import { ForbiddenError } from "@/lib/auth-guards";
import { buildAuditExportCsv } from "@/lib/reports/export-csv";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid export filters." }, { status: 400 });
  try {
    const result = await getAuditLogExportData(parsed.data);
    if (result.error) return Response.json({ error: result.error }, { status: 403 });
    return new Response(buildAuditExportCsv(result.rows), { headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-logs-${Date.now()}.csv"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    if (error instanceof ForbiddenError) return Response.json({ error: "Forbidden." }, { status: 403 });
    if (isAuthSessionError(error)) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    console.error("[audit-logs] Export failed:", error);
    return Response.json({ error: "Could not export audit logs. Please try again." }, { status: 500 });
  }
}
