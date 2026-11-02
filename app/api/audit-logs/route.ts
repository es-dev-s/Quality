import { getAuditLogs } from "@/lib/actions/audit";
import { auditLogQuerySchema } from "@/lib/audit/log-query";
import { isAuthSessionError } from "@/lib/auth-errors";
import { ForbiddenError } from "@/lib/auth-guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid filters." }, { status: 400 });
  try {
    return Response.json(await getAuditLogs(parsed.data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ForbiddenError) return Response.json({ error: "Forbidden." }, { status: 403 });
    if (isAuthSessionError(error)) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    console.error("[audit-logs] Page load failed:", error);
    return Response.json({ error: "Could not load audit logs. Please try again." }, { status: 500 });
  }
}
