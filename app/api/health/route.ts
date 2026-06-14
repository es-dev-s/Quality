import { collectAllowedOrigins } from "@/lib/deployment-origins";
import { getAppUrl, shouldTrustHost, shouldUseSecureCookies } from "@/lib/deployment";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTemplate } from "@/lib/audit/template-db";

export const runtime = "nodejs";

/** LAN / server diagnostics — no secrets. */
export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    appUrl: getAppUrl() ?? null,
    authTrustHost: shouldTrustHost(),
    secureCookies: shouldUseSecureCookies(),
    allowedOrigins: collectAllowedOrigins(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  try {
    await ensureDefaultTemplate();
    const templateCount = await prisma.formTemplate.count();
    checks.database = "ok";
    checks.templateCount = templateCount;
  } catch (error) {
    checks.ok = false;
    checks.database = error instanceof Error ? error.message : "connection failed";
  }

  return Response.json(checks, {
    status: checks.ok ? 200 : 503,
  });
}
