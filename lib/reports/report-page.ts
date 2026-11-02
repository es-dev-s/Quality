import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { pageInfo, type ServerPage } from "@/lib/server/page-query";
import { PASS_RATE_QUALITY_THRESHOLD } from "@/lib/audit/metrics-config";
import { REPORT_PAGE_SELECT, mapSubmissionToPageRow } from "@/lib/reports/audit-export-row";

/** Totals cover the complete filtered set; only detail rows are paginated. */
export async function fetchReportPage(where: Prisma.AuditSubmissionWhereInput, input: ServerPage, db = prisma) {
  const [groups, passCount] = await Promise.all([
    db.auditSubmission.groupBy({ by: ["hasFatal"], where, _count: { _all: true }, _sum: { qualityPct: true } }),
    db.auditSubmission.count({ where: { AND: [where, { hasFatal: false, qualityPct: { gte: PASS_RATE_QUALITY_THRESHOLD } }] } }),
  ]);
  const total = groups.reduce((sum, row) => sum + row._count._all, 0);
  const sum = groups.reduce((sum, row) => sum + (row.hasFatal ? 0 : row._sum.qualityPct ?? 0), 0);
  const fatals = groups.find((row) => row.hasFatal)?._count._all ?? 0;
  const pagination = pageInfo(total, input);
  const rows = await db.auditSubmission.findMany({ where, select: REPORT_PAGE_SELECT, orderBy: [{ auditDate: "desc" }, { createdAt: "desc" }, { id: "desc" }], skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize });
  return { rows: rows.map(mapSubmissionToPageRow), pagination, stats: { total, avgQuality: total ? Math.round(sum / total) : 0, passRate: total ? Math.round(passCount / total * 100) : 0, fatals } };
}
