import { resolveAuditSourceKind } from "@/lib/audit/audit-source";
import { parseFeedbackSecurity,parseFeedbackStatus } from "@/lib/audit/feedback";
import { defaultAuditHistoryFilter,viewerDefaultsToOwnedHistory } from "@/lib/audit/history-filter";
import { auditLogOrderBy,auditLogWhere,type AuditLogPage,type AuditLogQueryInput } from "@/lib/audit/log-query";
import { normalizeLegacyReferenceFields } from "@/lib/audit/validate-interaction-details";
import { toIsoTimestamp } from "@/lib/db/to-iso-timestamp";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AUDIT_LOG_LIST_SELECT } from "@/lib/select-shapes";
import type { Prisma } from "@prisma/client";

type LogRow = Prisma.AuditSubmissionGetPayload<{ select: typeof AUDIT_LOG_LIST_SELECT }>;

export function mapAuditLogEntry(row: LogRow) {
  const { submittedBy, createdAt, ...fields } = row;
  const legacy = normalizeLegacyReferenceFields(row.mobile ?? "", row.referenceUrl);
  const submittedByRoleSlug = submittedBy.role?.slug ?? null;
  return {
    ...fields,
    feedbackSecurity: parseFeedbackSecurity(row.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(row.feedbackStatus),
    mobile: legacy.mobile || null,
    referenceUrl: legacy.referenceUrl || null,
    submittedBy: submittedBy.name ?? submittedBy.email,
    submittedByRoleSlug,
    auditSource: resolveAuditSourceKind(submittedByRoleSlug),
    createdAt: toIsoTimestamp(createdAt),
  };
}

/** Bounded, read-only listing. Transfers are reconciled by the transfer write path. */
export async function fetchAuditLogPage(
  scope: Prisma.AuditSubmissionWhereInput,
  input: AuditLogQueryInput,
  viewer: { id: string; roleSlug: string },
  db = prisma,
): Promise<AuditLogPage> {
  const history = viewer.roleSlug === SYSTEM_ROLE_SLUGS.AGENT ? null : await db.auditSubmission.findFirst({
    where: { AND: [scope, { isHistory: true }, ...(viewerDefaultsToOwnedHistory(viewer.roleSlug, "logs") ? [] : [{ historyOwnerId: viewer.id }])] },
    select: { isHistory: true, historyOwnerId: true },
  });
  const defaultHistory = defaultAuditHistoryFilter(history ? [history] : [], viewer.id, viewer.roleSlug, "logs");
  const query = { ...input, historyFilter: viewer.roleSlug === SYSTEM_ROLE_SLUGS.AGENT ? "working" as const : input.historyFilter ?? defaultHistory };
  const where = auditLogWhere(scope, query);
  const [totalCount, filteredCount, options] = await Promise.all([
    db.auditSubmission.count({ where: scope }),
    db.auditSubmission.count({ where }),
    db.auditSubmission.groupBy({ by: ["agent", "businessType"], where: scope }),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / query.pageSize));
  query.page = Math.min(query.page, totalPages);
  const rows = await db.auditSubmission.findMany({
    where, select: AUDIT_LOG_LIST_SELECT, orderBy: auditLogOrderBy(query),
    skip: (query.page - 1) * query.pageSize, take: query.pageSize,
  });
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    query, totalCount, filteredCount, totalPages, defaultHistoryFilter: defaultHistory,
    submissions: rows.map(mapAuditLogEntry),
    filterOptions: { agents: unique(options.map((row) => row.agent)), businessTypes: unique(options.map((row) => row.businessType)) },
    fetchedAt: Date.now(),
  };
}
