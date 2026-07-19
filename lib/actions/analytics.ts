"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import { canFilterByAgent } from "@/lib/audit/agent-filter-access";
import { dataScopeFromSession } from "@/lib/audit/data-scope";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import type { AuditRow, CategoryScore } from "@/lib/audit/types";
import type { AnalyticsAuditRecord } from "@/lib/audit/analytics-metrics";
import { parseFeedbackSecurity } from "@/lib/audit/feedback";

function parseRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value as AuditRow[];
}

function parseCatScores(value: unknown): Record<string, CategoryScore> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, CategoryScore>;
}

async function fetchAnalyticsRecords(
  where: Awaited<ReturnType<typeof scopedAuditWhere>>
): Promise<AnalyticsAuditRecord[]> {
  const submissions = await prisma.auditSubmission.findMany({
    where,
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
      feedbackSecurity: true,
      reason: true,
      fatalList: true,
      isHistory: true,
      rows: true,
      catScores: true,
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
    feedbackSecurity: parseFeedbackSecurity(s.feedbackSecurity),
    reason: s.reason,
    fatalList: s.fatalList,
    isHistory: s.isHistory,
    rows: parseRows(s.rows),
    catScores: parseCatScores(s.catScores),
  }));
}

/** Loads scoped audit rows for client-side analytics filtering (period + segment). */
export async function getAnalyticsData() {
  const session = await requirePermission(PERMISSIONS.ANALYTICS_READ);
  const ctx = dataScopeFromSession(session);
  const [records, rosterAgentNames] = await Promise.all([
    fetchAnalyticsRecords(await scopedAuditWhere(session)),
    canFilterByAgent(session.user.role.slug)
      ? fetchAgentRosterNames(ctx.userId, ctx.role.slug)
      : Promise.resolve([] as string[]),
  ]);

  return {
    records,
    rosterAgentNames,
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
  };
}

export type AnalyticsPageData = Awaited<ReturnType<typeof getAnalyticsData>>;
