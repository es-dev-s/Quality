import { collectAllowedOrigins } from "@/lib/deployment-origins";
import { getAppUrl, shouldTrustHost } from "@/lib/deployment";
import { resolveUseSecureCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTemplate } from "@/lib/audit/template-db";

export const runtime = "nodejs";

/** LAN / server diagnostics — no secrets. */
export async function GET() {
  const checks: Record<string, unknown> = {
    ok: true,
    appUrl: getAppUrl() ?? null,
    authTrustHost: shouldTrustHost(),
    secureCookies: resolveUseSecureCookies(),
    authSecureCookiesEnv: process.env.AUTH_SECURE_COOKIES ?? null,
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
