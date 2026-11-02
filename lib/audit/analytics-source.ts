import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditRow, CategoryScore } from "@/lib/audit/types";
import type { AnalyticsAuditRecord } from "@/lib/audit/analytics-metrics";
import { parseFeedbackSecurity } from "@/lib/audit/feedback";
import { resolveAuditSourceKind } from "@/lib/audit/audit-source";
import { fetchPersonTeamNameMap, resolveRecordTeamName } from "@/lib/audit/resolve-team-name";
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

export async function fetchAnalyticsRecords(
  where: Prisma.AuditSubmissionWhereInput,
  db = prisma
): Promise<AnalyticsAuditRecord[]> {
  const submissions = await db.auditSubmission.findMany({
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
      historyOwnerId: true,
      teamNameSnapshot: true,
      rows: true,
      catScores: true,
      submittedBy: { select: { role: { select: { slug: true } } } },
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
    historyOwnerId: s.historyOwnerId ?? null,
    teamName: resolveRecordTeamName(
      {
        agent: s.agent,
        supervisor: s.supervisor,
        teamNameSnapshot: s.teamNameSnapshot,
      },
      teamByPerson
    ),
    auditSource: resolveAuditSourceKind(s.submittedBy.role?.slug),
    rows: parseRows(s.rows),
    catScores: parseCatScores(s.catScores),
  }));
}

