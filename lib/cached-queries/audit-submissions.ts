import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  CACHE_TAGS,
  CACHE_TTL,
  cacheScopeKey,
  type CacheScopeKey,
} from "@/lib/cache";
import {
  clampLimit,
  cursorWhereClause,
  decodeCursor,
  encodeCursor,
} from "@/lib/pagination";
import { auditSubmissionScopeWhere } from "@/lib/audit/data-scope";
import {
  AUDIT_CURSOR_SELECT,
  AUDIT_DASHBOARD_SELECT,
  AUDIT_LOG_LIST_SELECT,
} from "@/lib/select-shapes";
import { prisma } from "@/lib/prisma";

function dataScopeFromKey(scope: CacheScopeKey) {
  return {
    userId: scope.userId,
    userName: scope.userName,
    userEmail: scope.userEmail,
    role: {
      id: "",
      name: "",
      slug: scope.roleSlug,
      scopes: scope.roleScopes,
    },
  };
}

async function scopedWhereForKey(
  scope: CacheScopeKey,
  extra?: Prisma.AuditSubmissionWhereInput
): Promise<Prisma.AuditSubmissionWhereInput> {
  const rowScope = await auditSubmissionScopeWhere(dataScopeFromKey(scope));
  if (!rowScope && !extra) return {};
  if (!rowScope) return extra!;
  if (!extra) return rowScope;
  return { AND: [rowScope, extra] };
}

export function getCachedAuditLogs(scope: CacheScopeKey, limit: number) {
  const key = cacheScopeKey(scope);
  return unstable_cache(
    async () => {
      const where = await scopedWhereForKey(scope);
      const rows = await prisma.auditSubmission.findMany({
        where,
        select: AUDIT_LOG_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows;
    },
    [`audit-logs-${key}-${limit}`],
    {
      tags: [
        CACHE_TAGS.AUDIT_SUBMISSIONS,
        CACHE_TAGS.userAudits(scope.userId),
      ],
      revalidate: CACHE_TTL.REALTIME,
    }
  );
}

export function getCachedDashboardRecords(scope: CacheScopeKey) {
  const key = cacheScopeKey(scope);
  return unstable_cache(
    async () => {
      const where = await scopedWhereForKey(scope);
      return prisma.auditSubmission.findMany({
        where,
        select: AUDIT_DASHBOARD_SELECT,
        orderBy: { createdAt: "desc" },
      });
    },
    [`dashboard-records-${key}`],
    {
      tags: [
        CACHE_TAGS.AUDIT_SUBMISSIONS,
        CACHE_TAGS.userDashboard(scope.userId),
      ],
      revalidate: CACHE_TTL.REALTIME,
    }
  );
}

export function getCachedAuditSubmissionsPage(
  scope: CacheScopeKey,
  cursor: string | undefined,
  limit: number
) {
  const key = cacheScopeKey(scope);
  const cacheKey = cursor ?? "start";
  return unstable_cache(
    async () => {
      const decoded = cursor ? decodeCursor(cursor) : null;
      const cursorFilter = cursorWhereClause(decoded);
      const baseWhere = await scopedWhereForKey(scope);
      const where: Prisma.AuditSubmissionWhereInput = cursorFilter
        ? { AND: [baseWhere, cursorFilter as Prisma.AuditSubmissionWhereInput] }
        : baseWhere;

      const items = await prisma.auditSubmission.findMany({
        where,
        select: AUDIT_CURSOR_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      const hasMore = items.length > limit;
      if (hasMore) items.pop();

      const nextCursor =
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!.id, items[items.length - 1]!.createdAt)
          : null;

      return { items, nextCursor, hasMore };
    },
    [`audit-page-${key}-${cacheKey}-${limit}`],
    {
      tags: [
        CACHE_TAGS.AUDIT_SUBMISSIONS,
        CACHE_TAGS.userAudits(scope.userId),
      ],
      revalidate: CACHE_TTL.REALTIME,
    }
  );
}

export function parseAuditPageLimit(limit?: number) {
  return clampLimit(limit, 50, 200);
}
