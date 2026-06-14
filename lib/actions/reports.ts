"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";

export type ReportRow = {
  id: string;
  auditCode: string;
  agent: string;
  auditor: string | null;
  callDate: string;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
};

export async function getReportData(startDate: string, endDate: string) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);

  const submissions = await prisma.auditSubmission.findMany({
    where: scopedAuditWhere(session, {
      callDate: {
        gte: startDate,
        lte: endDate,
      },
    }),
    select: {
      id: true,
      auditCode: true,
      agent: true,
      auditor: true,
      callDate: true,
      qualityPct: true,
      finalPct: true,
      grade: true,
      hasFatal: true,
    },
    orderBy: { callDate: "desc" },
  });

  const rows: ReportRow[] = submissions.map((s) => ({
    id: s.id,
    auditCode: s.auditCode,
    agent: s.agent,
    auditor: s.auditor,
    callDate: s.callDate,
    qualityPct: s.qualityPct,
    finalPct: s.finalPct,
    grade: s.grade,
    hasFatal: s.hasFatal,
  }));

  const total = rows.length;
  const avgQuality =
    total > 0
      ? Math.round(rows.reduce((s, r) => s + r.qualityPct, 0) / total)
      : 0;
  const passCount = rows.filter(
    (r) => !r.hasFatal && r.qualityPct >= 75
  ).length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const fatals = rows.filter((r) => r.hasFatal).length;

  return {
    startDate,
    endDate,
    rows,
    stats: { total, avgQuality, passRate, fatals },
    generatedAt: new Date().toISOString(),
  };
}

export type ReportPageData = Awaited<ReturnType<typeof getReportData>>;
