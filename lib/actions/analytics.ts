"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import type { AuditRow } from "@/lib/audit/types";
import {
  computeQmsAnalytics,
  type AnalyticsAuditRecord,
} from "@/lib/audit/analytics-metrics";
import { computeLeaderboardAnalytics } from "@/lib/audit/leaderboard-metrics";

function parseRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value as AuditRow[];
}

async function fetchAnalyticsRecords(
  where: Awaited<ReturnType<typeof scopedAuditWhere>>,
  startDate?: string,
  endDate?: string
): Promise<AnalyticsAuditRecord[]> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate || endDate) {
    dateFilter.auditDate = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate   ? { lte: endDate   } : {}),
    };
  }
  const submissions = await prisma.auditSubmission.findMany({
    where: { ...where, ...dateFilter },
    select: {
      id: true,
      agent: true,
      supervisor: true,
      auditor: true,
      type: true,
      callDate: true,
      auditDate: true,
      qualityPct: true,
      finalPct: true,
      hasFatal: true,
      feedbackStatus: true,
      reason: true,
      fatalList: true,
      rows: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map((s) => ({
    id: s.id,
    agent: s.agent,
    supervisor: s.supervisor,
    auditor: s.auditor,
    type: s.type,
    callDate: s.callDate,
    auditDate: s.auditDate,
    qualityPct: s.qualityPct,
    finalPct: s.finalPct,
    hasFatal: s.hasFatal,
    feedbackStatus: s.feedbackStatus,
    reason: s.reason,
    fatalList: s.fatalList,
    rows: parseRows(s.rows),
  }));
}

export async function getAnalyticsData(
  startDate?: string,
  endDate?: string
) {
  const session = await requirePermission(PERMISSIONS.ANALYTICS_READ);
  const records = await fetchAnalyticsRecords(
    await scopedAuditWhere(session),
    startDate,
    endDate
  );
  return {
    ...computeQmsAnalytics(records),
    leaderboards: computeLeaderboardAnalytics(records),
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    dateFrom: startDate ?? null,
    dateTo: endDate ?? null,
  };
}

export type AnalyticsPageData = Awaited<ReturnType<typeof getAnalyticsData>>;
