"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { PASS_RATE_QUALITY_THRESHOLD, qualityPctForAverage } from "@/lib/audit/metrics-config";
import { reportDateRangeSchema } from "@/lib/validation/reports";
import { canExportAuditData } from "@/lib/rbac";
import {
  AUDIT_EXPORT_SELECT,
  REPORT_PAGE_SELECT,
  mapSubmissionToExportRow,
  mapSubmissionToPageRow,
  type AuditExportRow,
} from "@/lib/reports/audit-export-row";

/** @deprecated Use AuditExportRow from `@/lib/reports/audit-export-row`. */
export type ReportRow = AuditExportRow;

export async function getReportData(startDate: string, endDate: string) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);

  const parsed = reportDateRangeSchema.safeParse({ startDate, endDate });
  if (!parsed.success) {
    return {
      startDate,
      endDate,
      rows: [] as AuditExportRow[],
      stats: { total: 0, avgQuality: 0, passRate: 0, fatals: 0 },
      generatedAt: new Date().toISOString(),
      error: parsed.error.issues[0]?.message ?? "Invalid date range.",
    };
  }

  const range = parsed.data;

  const submissions = await prisma.auditSubmission.findMany({
    where: await scopedAuditWhere(session, {
      auditDate: {
        gte: range.startDate,
        lte: range.endDate,
      },
    }),
    select: REPORT_PAGE_SELECT,
    orderBy: { auditDate: "desc" },
  });

  const rows = submissions.map(mapSubmissionToPageRow);

  const total = rows.length;
  const avgQuality =
    total > 0
      ? Math.round(rows.reduce((s, r) => s + qualityPctForAverage(r), 0) / total)
      : 0;
  const passCount = rows.filter(
    (r) => !r.hasFatal && r.qualityPct >= PASS_RATE_QUALITY_THRESHOLD
  ).length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const fatals = rows.filter((r) => r.hasFatal).length;

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rows,
    stats: { total, avgQuality, passRate, fatals },
    generatedAt: new Date().toISOString(),
    error: null as string | null,
  };
}

export async function getReportExportData(startDate: string, endDate: string) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);
  if (!canExportAuditData(session.user.role)) {
    return {
      startDate,
      endDate,
      rows: [] as AuditExportRow[],
      error: "You do not have permission to export reports.",
    };
  }

  const parsed = reportDateRangeSchema.safeParse({ startDate, endDate });
  if (!parsed.success) {
    return {
      startDate,
      endDate,
      rows: [] as AuditExportRow[],
      error: parsed.error.issues[0]?.message ?? "Invalid date range.",
    };
  }

  const range = parsed.data;
  const submissions = await prisma.auditSubmission.findMany({
    where: await scopedAuditWhere(session, {
      auditDate: {
        gte: range.startDate,
        lte: range.endDate,
      },
    }),
    select: AUDIT_EXPORT_SELECT,
    orderBy: { auditDate: "desc" },
  });

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rows: submissions.map(mapSubmissionToExportRow),
    error: null as string | null,
  };
}

export type ReportPageData = Awaited<ReturnType<typeof getReportData>>;
