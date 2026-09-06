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
import {
  fetchPersonTeamNameMap,
  resolveRecordTeamName,
} from "@/lib/audit/resolve-team-name";

function parseRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};
    const max = Number(row.max);
    const score = Number(row.score);
    return {
      id: typeof row.id === "string" ? row.id : "",
      cat: typeof row.cat === "string" ? row.cat : "",
      name: typeof row.name === "string" ? row.name : "",
      max: Number.isFinite(max) ? max : 0,
      sel: typeof row.sel === "string" ? row.sel : String(row.sel ?? ""),
      score: Number.isFinite(score) ? score : 0,
      fatal: Boolean(row.fatal),
    };
  });
}

function parseCatScores(value: unknown): Record<string, CategoryScore> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, CategoryScore> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const cat = raw as Record<string, unknown>;
    const scored = Number(cat.scored);
    const max = Number(cat.max);
    if (!Number.isFinite(scored) || !Number.isFinite(max)) continue;
    out[key] = { scored, max };
  }
  return out;
}

async function fetchAnalyticsRecords(
  where: Awaited<ReturnType<typeof scopedAuditWhere>>
): Promise<AnalyticsAuditRecord[]> {
  const submissions = await prisma.auditSubmission.findMany({
    where,
    select: {
      id: true,
      auditCode: true,
      agent: true,
      supervisor: true,
      auditor: true,
      lob: true,
      type: true,
      businessType: true,
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
      teamNameSnapshot: true,
      rows: true,
      catScores: true,
    },
  });
  const teamByPerson = await fetchPersonTeamNameMap();

  return submissions.map((s) => ({
    id: s.id,
    auditCode: s.auditCode,
    agent: s.agent,
    supervisor: s.supervisor,
    auditor: s.auditor,
    lob: s.lob,
    type: s.type,
    businessType: s.businessType,
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
    teamName: resolveRecordTeamName(
      {
        agent: s.agent,
        supervisor: s.supervisor,
        teamNameSnapshot: s.teamNameSnapshot,
      },
      teamByPerson
    ),
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
