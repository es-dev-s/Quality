import { auth } from "@/lib/auth";
import { collectAllowedOrigins } from "@/lib/deployment-origins";
import { getAppUrl, shouldTrustHost } from "@/lib/deployment";
import { resolveUseSecureCookies } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { ensureDefaultTemplate } from "@/lib/audit/template-db";
import { isSuperAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

/** Public liveness probe; detailed diagnostics require superadmin session. */
export async function GET() {
  const publicBody = {
    ok: true,
    timestamp: new Date().toISOString(),
  };

  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  if (!session?.user?.id || !isSuperAdmin(session.user.role)) {
    try {
      await ensureDefaultTemplate();
      await prisma.formTemplate.count();
    } catch {
      return Response.json(
        { ok: false, timestamp: publicBody.timestamp },
        { status: 503 }
      );
    }

    return Response.json(publicBody);
  }

  const checks: Record<string, unknown> = {
    ...publicBody,
    appUrl: getAppUrl() ?? null,
    authTrustHost: shouldTrustHost(),
    secureCookies: resolveUseSecureCookies(),
    authSecureCookiesEnv: process.env.AUTH_SECURE_COOKIES ?? null,
    allowedOrigins: collectAllowedOrigins(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  try {
    await ensureDefaultTemplate();
    checks.templateCount = await prisma.formTemplate.count();
    checks.database = "ok";
  } catch {
    checks.ok = false;
    checks.database = "connection failed";
  }

  return Response.json(checks, {
    status: checks.ok ? 200 : 503,
  });
}
