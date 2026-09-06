"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { dataScopeFromSession } from "@/lib/audit/data-scope";
import {
  fetchAgentRosterNames,
  fetchProvisionedAgentNamesBySupervisorUserIds,
} from "@/lib/audit/agent-roster";
import { canFilterByAgent } from "@/lib/audit/agent-filter-access";
import { caseInsensitiveEquals } from "@/lib/audit/prisma-string-filters";
import { PASS_RATE_QUALITY_THRESHOLD, qualityPctForAverage } from "@/lib/audit/metrics-config";
import {
  fetchActiveAgentUserNames,
  fetchSupervisorRoleUsers,
} from "@/lib/audit/role-users";
import {
  addRelatedName,
  toSortedNameRecord,
} from "@/lib/reports/report-filter-options";
import {
  reportFiltersSchema,
  type ReportFilters,
} from "@/lib/validation/reports";
import { canExportAuditData } from "@/lib/rbac";
import {
  AUDIT_EXPORT_SELECT,
  REPORT_PAGE_SELECT,
  mapSubmissionToExportRow,
  mapSubmissionToPageRow,
  type AuditExportRow,
} from "@/lib/reports/audit-export-row";

/** @deprecated Use AuditExportRow from `@/lib/reports/audit-export-row`. */
export type ReportRow = AuditExportRow;

export type ReportFilterOptions = {
  agents: string[];
  supervisors: string[];
  agentsBySupervisor: Record<string, string[]>;
  supervisorsByAgent: Record<string, string[]>;
};

const EMPTY_STATS = {
  total: 0,
  avgQuality: 0,
  passRate: 0,
  fatals: 0,
};

function canLoadOrgPeopleRoster(roleSlug: string): boolean {
  return (
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    roleSlug === SYSTEM_ROLE_SLUGS.ADMIN
  );
}

function emptyReport(
  filters: Pick<ReportFilters, "startDate" | "endDate">,
  error: string
) {
  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    rows: [] as AuditExportRow[],
    stats: EMPTY_STATS,
    generatedAt: new Date().toISOString(),
    error,
  };
}

function uniqueSortedNames(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function parseReportFilters(input: unknown) {
  const parsed = reportFiltersSchema.safeParse(input);
  if (!parsed.success) {
    const fallback = input && typeof input === "object" ? (input as Partial<ReportFilters>) : null;
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid report filters.",
      filters: {
        startDate: fallback?.startDate ?? "",
        endDate: fallback?.endDate ?? "",
        agent: "",
        supervisor: "",
        type: "" as const,
        period: "custom" as const,
      },
    };
  }
  return { error: null, filters: parsed.data };
}

async function reportWhere(
  session: Parameters<typeof scopedAuditWhere>[0],
  filters: ReportFilters
): Promise<Prisma.AuditSubmissionWhereInput> {
  const extra: Prisma.AuditSubmissionWhereInput = {
    auditDate: {
      gte: filters.startDate,
      lte: filters.endDate,
    },
  };

  const agent = caseInsensitiveEquals(filters.agent);
  if (agent) extra.agent = agent;

  const supervisor = caseInsensitiveEquals(filters.supervisor);
  if (supervisor) extra.supervisor = supervisor;

  const type = caseInsensitiveEquals(filters.type);
  if (type && (filters.type === "Call" || filters.type === "Chat")) {
    extra.type = type;
  }

  return scopedAuditWhere(session, extra);
}

export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);
  const ctx = dataScopeFromSession(session);
  const scope = await scopedAuditWhere(session);
  const loadOrgRoster = canLoadOrgPeopleRoster(ctx.role.slug);

  const [pairs, rosterAgentNames, supervisorUsers] = await Promise.all([
    prisma.auditSubmission.groupBy({
      by: ["agent", "supervisor"],
      where: scope,
    }),
    canFilterByAgent(ctx.role.slug)
      ? fetchAgentRosterNames(ctx.userId, ctx.role.slug)
      : loadOrgRoster
        ? fetchActiveAgentUserNames()
        : Promise.resolve([] as string[]),
    loadOrgRoster ? fetchSupervisorRoleUsers() : Promise.resolve([]),
  ]);

  const provisionedBySupervisor =
    supervisorUsers.length > 0
      ? await fetchProvisionedAgentNamesBySupervisorUserIds(
          supervisorUsers.map((user) => user.id)
        )
      : new Map<string, string[]>();

  const agentsBySupervisor = new Map<string, Set<string>>();
  const supervisorsByAgent = new Map<string, Set<string>>();

  for (const row of pairs) {
    const agent = row.agent?.trim() ?? "";
    const supervisor = row.supervisor?.trim() ?? "";
    addRelatedName(agentsBySupervisor, supervisor, agent);
    addRelatedName(supervisorsByAgent, agent, supervisor);
  }

  for (const supervisor of supervisorUsers) {
    const agents = provisionedBySupervisor.get(supervisor.id) ?? [];
    for (const agent of agents) {
      addRelatedName(agentsBySupervisor, supervisor.name, agent);
      addRelatedName(supervisorsByAgent, agent, supervisor.name);
    }
  }

  return {
    agents: uniqueSortedNames([
      ...rosterAgentNames,
      ...pairs.map((row) => row.agent),
      ...[...supervisorsByAgent.keys()],
    ]),
    supervisors: uniqueSortedNames([
      ...supervisorUsers.map((user) => user.name),
      ...pairs.map((row) => row.supervisor),
    ]),
    agentsBySupervisor: toSortedNameRecord(agentsBySupervisor),
    supervisorsByAgent: toSortedNameRecord(supervisorsByAgent),
  };
}

export async function getReportData(input: ReportFilters) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);
  const parsed = parseReportFilters(input);
  if (parsed.error) {
    return emptyReport(parsed.filters, parsed.error);
  }

  const submissions = await prisma.auditSubmission.findMany({
    where: await reportWhere(session, parsed.filters),
    select: REPORT_PAGE_SELECT,
    orderBy: { auditDate: "desc" },
  });

  const rows = submissions.map(mapSubmissionToPageRow);
  const total = rows.length;
  const avgQuality =
    total > 0
      ? Math.round(rows.reduce((sum, row) => sum + qualityPctForAverage(row), 0) / total)
      : 0;
  const passCount = rows.filter(
    (row) => !row.hasFatal && row.qualityPct >= PASS_RATE_QUALITY_THRESHOLD
  ).length;

  return {
    startDate: parsed.filters.startDate,
    endDate: parsed.filters.endDate,
    rows,
    stats: {
      total,
      avgQuality,
      passRate: total > 0 ? Math.round((passCount / total) * 100) : 0,
      fatals: rows.filter((row) => row.hasFatal).length,
    },
    generatedAt: new Date().toISOString(),
    error: null as string | null,
  };
}

export async function getReportExportData(input: ReportFilters) {
  const session = await requirePermission(PERMISSIONS.REPORTS_READ);
  if (!canExportAuditData(session.user.role)) {
    return {
      startDate: input.startDate,
      endDate: input.endDate,
      rows: [] as AuditExportRow[],
      error: "You do not have permission to export reports.",
    };
  }

  const parsed = parseReportFilters(input);
  if (parsed.error) {
    return {
      startDate: parsed.filters.startDate,
      endDate: parsed.filters.endDate,
      rows: [] as AuditExportRow[],
      error: parsed.error,
    };
  }

  const submissions = await prisma.auditSubmission.findMany({
    where: await reportWhere(session, parsed.filters),
    select: AUDIT_EXPORT_SELECT,
    orderBy: { auditDate: "desc" },
  });

  return {
    startDate: parsed.filters.startDate,
    endDate: parsed.filters.endDate,
    rows: submissions.map(mapSubmissionToExportRow),
    error: null as string | null,
  };
}

export type ReportPageData = Awaited<ReturnType<typeof getReportData>>;
