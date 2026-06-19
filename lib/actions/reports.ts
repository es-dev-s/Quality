"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { PASS_RATE_QUALITY_THRESHOLD } from "@/lib/audit/metrics-config";
import type { AuditRow } from "@/lib/audit/types";
import { reportDateRangeSchema } from "@/lib/validation/reports";
import { normalizeLegacyReferenceFields } from "@/lib/audit/validate-interaction-details";

function parseRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value as AuditRow[];
}

function parseFatalList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function formatParameterExport(rows: AuditRow[]): string {
  return rows
    .map((row) => {
      const pct = row.max > 0 ? Math.round((row.score / row.max) * 100) : 0;
      return `${row.cat} | ${row.name}: ${row.sel} (${row.score}/${row.max}, ${pct}%)`;
    })
    .join("; ");
}

export type ReportRow = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  auditor: string | null;
  type: string;
  businessType: string;
  callDate: string;
  auditDate: string;
  lob: string;
  sublob: string | null;
  reason: string | null;
  subReason: string | null;
  mobile: string | null;
  referenceUrl: string | null;
  response: string | null;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  fatalList: string[];
  totalScored: number;
  totalMax: number;
  feedbackSecurity: string;
  feedbackStatus: string;
  feedbackDate: string | null;
  feedbackStatusAt: string | null;
  agentFeedback: string;
  supervisorRemarks: string;
  submittedBy: string;
  createdAt: string;
  parameterSummary: string;
  rows: AuditRow[];
};

export async function getReportData(startDate: string, endDate: string) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);

  const parsed = reportDateRangeSchema.safeParse({ startDate, endDate });
  if (!parsed.success) {
    return {
      startDate,
      endDate,
      rows: [],
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
    select: {
      id: true,
      auditCode: true,
      agent: true,
      supervisor: true,
      auditor: true,
      type: true,
      businessType: true,
      callDate: true,
      auditDate: true,
      lob: true,
      sublob: true,
      reason: true,
      mobile: true,
      referenceUrl: true,
      response: true,
      qualityPct: true,
      finalPct: true,
      grade: true,
      hasFatal: true,
      fatalList: true,
      totalScored: true,
      totalMax: true,
      feedbackSecurity: true,
      feedbackStatus: true,
      feedbackDate: true,
      feedbackStatusAt: true,
      agentFeedback: true,
      supervisorRemarks: true,
      rows: true,
      record: true,
      createdAt: true,
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: { auditDate: "desc" },
  });

  const rows: ReportRow[] = submissions.map((s) => {
    const auditRows = parseRows(s.rows);
    const record = s.record as { subReason?: unknown } | null;
    const subReason =
      typeof record?.subReason === "string" ? record.subReason : null;
    const legacy = normalizeLegacyReferenceFields(
      s.mobile ?? "",
      s.referenceUrl
    );

    return {
      id: s.id,
      auditCode: s.auditCode,
      agent: s.agent,
      supervisor: s.supervisor,
      auditor: s.auditor,
      type: s.type,
      businessType: s.businessType,
      callDate: s.callDate,
      auditDate: s.auditDate,
      lob: s.lob,
      sublob: s.sublob,
      reason: s.reason,
      subReason,
      mobile: legacy.mobile || null,
      referenceUrl: legacy.referenceUrl || null,
      response: s.response,
      qualityPct: s.qualityPct,
      finalPct: s.finalPct,
      grade: s.grade,
      hasFatal: s.hasFatal,
      fatalList: parseFatalList(s.fatalList),
      totalScored: s.totalScored,
      totalMax: s.totalMax,
      feedbackSecurity: s.feedbackSecurity,
      feedbackStatus: s.feedbackStatus,
      feedbackDate: s.feedbackDate,
      feedbackStatusAt: s.feedbackStatusAt,
      agentFeedback: s.agentFeedback ?? "",
      supervisorRemarks: s.supervisorRemarks ?? "",
      submittedBy: s.submittedBy.name ?? s.submittedBy.email,
      createdAt: s.createdAt.toISOString(),
      parameterSummary: formatParameterExport(auditRows),
      rows: auditRows,
    };
  });

  const total = rows.length;
  const avgQuality =
    total > 0
      ? Math.round(rows.reduce((s, r) => s + r.qualityPct, 0) / total)
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

export type ReportPageData = Awaited<ReturnType<typeof getReportData>>;
