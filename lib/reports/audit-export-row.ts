import type { Prisma } from "@prisma/client";
import type { CategoryScore, AuditRow } from "@/lib/audit/types";
import { normalizeLegacyReferenceFields } from "@/lib/audit/validate-interaction-details";

export type AuditExportRow = {
  id: string;
  auditCode: string;
  templateName: string | null;
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
  catScores: Record<string, CategoryScore>;
  rows: AuditRow[];
};

/** @deprecated Use AuditExportRow — kept for existing report imports. */
export type ReportRow = AuditExportRow;

export const AUDIT_EXPORT_SELECT = {
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
  catScores: true,
  record: true,
  createdAt: true,
  template: { select: { name: true } },
  submittedBy: { select: { name: true, email: true } },
} satisfies Prisma.AuditSubmissionSelect;

export type AuditExportSubmission = Prisma.AuditSubmissionGetPayload<{
  select: typeof AUDIT_EXPORT_SELECT;
}>;

export function parseAuditRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value as AuditRow[];
}

export function parseFatalList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseCatScores(value: unknown): Record<string, CategoryScore> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, CategoryScore>;
}

export function formatCategoryScores(
  catScores: Record<string, CategoryScore>
): string {
  return Object.entries(catScores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, { scored, max }]) => `${name}: ${scored}/${max}`)
    .join("; ");
}

export function parameterColumnKey(row: AuditRow): string {
  return `${row.cat} › ${row.name}`;
}

export function parameterCellValue(row: AuditRow): string {
  const fatal = row.fatal ? " [FATAL]" : "";
  return `${row.sel} (${row.score}/${row.max})${fatal}`;
}

export function collectParameterColumnKeys(rows: AuditExportRow[]): string[] {
  const keys = new Set<string>();
  for (const audit of rows) {
    for (const param of audit.rows) {
      keys.add(parameterColumnKey(param));
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function mapSubmissionToExportRow(
  submission: AuditExportSubmission
): AuditExportRow {
  const auditRows = parseAuditRows(submission.rows);
  const record = submission.record as { subReason?: unknown } | null;
  const subReason =
    typeof record?.subReason === "string" ? record.subReason : null;
  const legacy = normalizeLegacyReferenceFields(
    submission.mobile ?? "",
    submission.referenceUrl
  );

  return {
    id: submission.id,
    auditCode: submission.auditCode,
    templateName: submission.template?.name ?? null,
    agent: submission.agent,
    supervisor: submission.supervisor,
    auditor: submission.auditor,
    type: submission.type,
    businessType: submission.businessType,
    callDate: submission.callDate,
    auditDate: submission.auditDate,
    lob: submission.lob,
    sublob: submission.sublob,
    reason: submission.reason,
    subReason,
    mobile: legacy.mobile || null,
    referenceUrl: legacy.referenceUrl || null,
    response: submission.response,
    qualityPct: submission.qualityPct,
    finalPct: submission.finalPct,
    grade: submission.grade,
    hasFatal: submission.hasFatal,
    fatalList: parseFatalList(submission.fatalList),
    totalScored: submission.totalScored,
    totalMax: submission.totalMax,
    feedbackSecurity: submission.feedbackSecurity,
    feedbackStatus: submission.feedbackStatus,
    feedbackDate: submission.feedbackDate,
    feedbackStatusAt: submission.feedbackStatusAt,
    agentFeedback: submission.agentFeedback ?? "",
    supervisorRemarks: submission.supervisorRemarks ?? "",
    submittedBy:
      submission.submittedBy.name ?? submission.submittedBy.email ?? "",
    createdAt:
      submission.createdAt instanceof Date
        ? submission.createdAt.toISOString()
        : String(submission.createdAt),
    catScores: parseCatScores(submission.catScores),
    rows: auditRows,
  };
}
