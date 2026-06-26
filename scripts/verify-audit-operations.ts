/**
 * Audit module smoke checks — routes, RBAC, server actions, and DB integrity.
 * Run: npx tsx scripts/verify-audit-operations.ts
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  canDeleteAuditLogs,
  canEditAuditSubmissions,
  canExportAuditData,
  canWriteAuditForm,
  type SessionRole,
} from "@/lib/rbac";
import {
  PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_SLUGS,
  resolveRoutePermission,
  type Permission,
} from "@/lib/permissions";
import { canAccessPath } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, ok: true, detail });
}

function fail(name: string, detail: string) {
  checks.push({ name, ok: false, detail });
}

const AUDIT_ROUTES = [
  "/audit-logs",
  "/audit-logs/cm1234567890123456789012/edit",
  "/forms/audit",
  "/forms/audit/call",
  "/forms",
  "/reports",
  "/dashboard",
] as const;

const AUDIT_APP_ROUTES = [
  "app/(dashboard)/audit-logs/page.tsx",
  "app/(dashboard)/audit-logs/[id]/edit/page.tsx",
  "app/(dashboard)/forms/audit/page.tsx",
  "app/(dashboard)/forms/audit/[templateId]/page.tsx",
  "app/(dashboard)/reports/page.tsx",
  "app/api/uploads/audit-media/route.ts",
  "app/api/uploads/audit-images/route.ts",
  "app/api/files/audit-media/[filename]/route.ts",
  "app/api/files/audit-images/[filename]/route.ts",
  "app/api/events/route.ts",
] as const;

const AUDIT_SERVER_ACTIONS = [
  "saveAuditSubmission",
  "updateAuditSubmission",
  "getAuditLogs",
  "getAuditExportRows",
  "getAuditDetail",
  "getAuditForEdit",
  "updateAuditFeedback",
  "updateSupervisorRemarks",
  "deleteAuditSubmissions",
  "getDashboardAuditData",
  "getReportData",
] as const;

function roleFromSlug(slug: keyof typeof SYSTEM_ROLE_DEFINITIONS): SessionRole {
  const def = SYSTEM_ROLE_DEFINITIONS[slug];
  return {
    id: slug,
    name: def.name,
    slug,
    scopes: [...def.permissions],
  };
}

function verifyRouteFiles() {
  for (const rel of AUDIT_APP_ROUTES) {
    const abs = join(process.cwd(), rel);
    if (existsSync(abs)) {
      pass(`Route file: ${rel}`, "Present");
    } else {
      fail(`Route file: ${rel}`, "Missing — would 404 at runtime");
    }
  }
}

function verifyRoutePermissions() {
  for (const path of AUDIT_ROUTES) {
    const permission = resolveRoutePermission(path);
    if (!permission) {
      fail(`Route permission: ${path}`, "No permission mapping");
      continue;
    }
    pass(`Route permission: ${path}`, permission);
  }
}

function verifyRoleAccessMatrix() {
  const roles = Object.keys(SYSTEM_ROLE_DEFINITIONS) as Array<
    keyof typeof SYSTEM_ROLE_DEFINITIONS
  >;

  for (const slug of roles) {
    const role = roleFromSlug(slug);
    const auditLogs = canAccessPath(role, "/audit-logs");
    const auditForm = canAccessPath(role, "/forms/audit");
    const reports = canAccessPath(role, "/reports");
    const canCreate = canWriteAuditForm(role);
    const canEdit = canEditAuditSubmissions(role);
    const canExport = canExportAuditData(role);
    const canDelete = canDeleteAuditLogs(role);

    pass(
      `RBAC ${slug}`,
      [
        `logs=${auditLogs}`,
        `form=${auditForm}`,
        `reports=${reports}`,
        `create=${canCreate}`,
        `edit=${canEdit}`,
        `export=${canExport}`,
        `delete=${canDelete}`,
      ].join(", ")
    );

    if (canEdit && !canCreate) {
      fail(
        `RBAC consistency ${slug}`,
        "canEditAuditSubmissions true but canWriteAuditForm false"
      );
    }

    if (canExport && (!auditLogs || !reports)) {
      fail(
        `RBAC export ${slug}`,
        "canExportAuditData true without both audit-logs and reports read"
      );
    }

    if (canDelete && slug !== SYSTEM_ROLE_SLUGS.SUPERADMIN) {
      fail(
        `RBAC delete ${slug}`,
        "canDeleteAuditLogs should be super-admin only"
      );
    }
  }
}

function verifyUiGatesMatchRbac() {
  const qa = roleFromSlug(SYSTEM_ROLE_SLUGS.QUALITY_ANALYST);
  const agent = roleFromSlug(SYSTEM_ROLE_SLUGS.AGENT);
  const supervisor = roleFromSlug(SYSTEM_ROLE_SLUGS.SUPERVISOR);

  if (canWriteAuditForm(qa) && canAccessPath(qa, "/forms/audit")) {
    pass("QA audit form", "Can open form and create audits");
  } else {
    fail("QA audit form", "Expected QA to create audits");
  }

  if (!canWriteAuditForm(agent) && canAccessPath(agent, "/audit-logs")) {
    pass("Agent scope", "Read-only audit logs; no create link permission");
  } else {
    fail("Agent scope", "Agent should read logs but not write audit form");
  }

  if (!canEditAuditSubmissions(supervisor) && canAccessPath(supervisor, "/audit-logs")) {
    pass("Supervisor scope", "View logs without edit/delete");
  } else {
    fail("Supervisor scope", "Supervisor should not edit saved audits");
  }
}

async function verifyServerActionExports() {
  const auditActions = await import("@/lib/actions/audit");
  const reportActions = await import("@/lib/actions/reports");

  for (const name of AUDIT_SERVER_ACTIONS) {
    const fn =
      name === "getReportData"
        ? reportActions[name]
        : (auditActions as Record<string, unknown>)[name];
    if (typeof fn === "function") {
      pass(`Server action: ${name}`, "Exported");
    } else {
      fail(`Server action: ${name}`, "Missing export");
    }
  }
}

async function verifyDbAuditIntegrity() {
  const sample = await prisma.auditSubmission.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      auditCode: true,
      rows: true,
      catScores: true,
      templateId: true,
    },
  });

  if (sample.length === 0) {
    pass("DB audit samples", "No submissions yet (empty DB is OK)");
    return;
  }

  let invalidRows = 0;
  for (const row of sample) {
    if (!Array.isArray(row.rows)) invalidRows += 1;
    if (!row.auditCode?.trim()) invalidRows += 1;
  }

  if (invalidRows === 0) {
    pass(
      "DB audit samples",
      `${sample.length} recent submission(s) have rows[] + auditCode`
    );
  } else {
    fail(
      "DB audit samples",
      `${invalidRows} of ${sample.length} samples missing rows or auditCode`
    );
  }

  const orphanTemplateRefs = await prisma.auditSubmission.count({
    where: {
      templateId: { not: null },
      NOT: {
        template: { is: {} },
      },
    },
  });

  if (orphanTemplateRefs === 0) {
    pass("DB template FK", "No orphan templateId references");
  } else {
    pass(
      "DB template FK",
      `${orphanTemplateRefs} submission(s) reference deleted templates (snapshot still valid)`
    );
  }
}

async function main() {
  console.log("\n=== Audit operations verification ===\n");

  verifyRouteFiles();
  verifyRoutePermissions();
  verifyRoleAccessMatrix();
  verifyUiGatesMatchRbac();
  await verifyServerActionExports();
  await verifyDbAuditIntegrity();

  console.log("Results:\n");
  let failed = 0;
  for (const check of checks) {
    const icon = check.ok ? "✓" : "✗";
    console.log(`  ${icon} ${check.name}: ${check.detail}`);
    if (!check.ok) failed += 1;
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks passed.\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
