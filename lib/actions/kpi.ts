"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import {
  fetchActiveQualityAnalystUserNames,
  fetchUsersByRoleSlugs,
} from "@/lib/audit/role-users";
import { dataScopeFromSession } from "@/lib/audit/data-scope";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import type { KpiFilterOptions } from "@/lib/kpi/filters";
import {
  type KpiAuditRecord,
  type KpiPageData,
} from "@/lib/kpi/records";
import { readAuditTargets } from "@/lib/kpi/audit-targets";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function getKpiFilterOptions(): Promise<KpiFilterOptions> {
  await requireSuperAdmin();

  const [qmUsers, qualityAnalysts] = await Promise.all([
    fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]),
    fetchActiveQualityAnalystUserNames(),
  ]);

  const qualityManagers = qmUsers.map((user) => user.name);

  const qmAgentNamesByQm: Record<string, string[]> = {};
  await Promise.all(
    qmUsers.map(async (user) => {
      const names = await fetchAgentRosterNames(
        user.id,
        SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
      );
      qmAgentNamesByQm[user.name] = names;
    })
  );

  return {
    qualityManagers: qualityManagers ?? [],
    qualityAnalysts: qualityAnalysts ?? [],
    qmAgentNamesByQm: qmAgentNamesByQm ?? {},
  };
}

async function fetchKpiRecords(
  where: Awaited<ReturnType<typeof scopedAuditWhere>>
): Promise<KpiAuditRecord[]> {
  const submissions = await prisma.auditSubmission.findMany({
    where,
    select: {
      id: true,
      agent: true,
      supervisor: true,
      auditor: true,
      type: true,
      auditType: true,
      callDate: true,
      auditDate: true,
      qualityPct: true,
      finalPct: true,
      hasFatal: true,
      feedbackStatus: true,
      isHistory: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions.map((s) => ({
    id: s.id,
    agent: s.agent,
    supervisor: s.supervisor,
    auditor: s.auditor,
    type: s.type,
    auditType: s.auditType,
    callDate: s.callDate,
    auditDate: s.auditDate,
    qualityPct: s.qualityPct,
    finalPct: s.finalPct,
    hasFatal: s.hasFatal,
    feedbackStatus: s.feedbackStatus,
    isHistory: s.isHistory,
  }));
}

/** Loads audit rows for client-side KPI filtering (time + QM roster + QA). */
export async function getKpiData(): Promise<KpiPageData> {
  const session = await requireSuperAdmin();
  const ctx = dataScopeFromSession(session);

  const [records, rosterAgentNames, targets] = await Promise.all([
    fetchKpiRecords(await scopedAuditWhere(session)),
    fetchAgentRosterNames(ctx.userId, ctx.role.slug),
    readAuditTargets(session.user.id),
  ]);

  return {
    records,
    rosterAgentNames,
    targetPerAgent: targets.perAgent,
    fetchedAt: new Date().toISOString(),
  };
}
