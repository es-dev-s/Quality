/**
 * Canonical agent roster rules — single source of truth for who "owns" which agents.
 *
 * Supervisor: active agents they provisioned (createdById).
 * Quality Analyst: active agents assigned by QM + active agents they provisioned.
 * Quality Manager: active agents they approved or assigned through the platform.
 */
import { prisma } from "@/lib/prisma";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  ACTIVE_USER_WHERE,
  isLoginEligibleUser,
  withActiveUserFilter,
} from "@/lib/user-active-filter";

export type AgentRosterSource = "provisioned" | "assigned";

export type AgentRosterEntry = {
  id: string;
  name: string;
  email: string;
  source: AgentRosterSource;
};

function mapAgentUser(user: {
  id: string;
  name: string | null;
  email: string;
}): Pick<AgentRosterEntry, "id" | "name" | "email"> {
  return {
    id: user.id,
    name: resolveRoleUserName(user),
    email: user.email,
  };
}

function mergeRosterEntries(entries: AgentRosterEntry[]): AgentRosterEntry[] {
  const byId = new Map<string, AgentRosterEntry>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }
    if (existing.source === "provisioned" && entry.source === "assigned") {
      continue;
    }
    byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchProvisionedAgentEntries(
  ownerUserId: string
): Promise<AgentRosterEntry[]> {
  const users = await prisma.user.findMany({
    where: withActiveUserFilter({
      createdById: ownerUserId,
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
    }),
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.map((user) => ({
    ...mapAgentUser(user),
    source: "provisioned" as const,
  }));
}

export async function fetchAssignedAgentEntries(
  assigneeUserId: string
): Promise<AgentRosterEntry[]> {
  const rows = await prisma.agentAssignment.findMany({
    where: { assignedToId: assigneeUserId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          approvalStatus: true,
          role: { select: { slug: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  const entries: AgentRosterEntry[] = [];
  for (const row of rows) {
    if (row.agent.role.slug !== SYSTEM_ROLE_SLUGS.AGENT) continue;
    if (!isLoginEligibleUser(row.agent)) continue;
    entries.push({
      ...mapAgentUser(row.agent),
      source: "assigned",
    });
  }
  return entries;
}

export async function fetchQmApprovedAgentUserIds(
  qualityManagerId: string
): Promise<string[]> {
  const approved = await prisma.userProvisioningRequest.findMany({
    where: {
      reviewedById: qualityManagerId,
      status: "APPROVED",
      targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
      createdUserId: { not: null },
    },
    select: { createdUserId: true },
  });

  return approved
    .map((row) => row.createdUserId)
    .filter((id): id is string => Boolean(id));
}

export async function fetchQmAssignedAgentUserIds(
  qualityManagerId: string
): Promise<string[]> {
  const rows = await prisma.agentAssignment.findMany({
    where: { assignedById: qualityManagerId },
    select: { agentId: true },
  });
  return [...new Set(rows.map((row) => row.agentId))];
}

async function fetchQmAgentEntries(
  qualityManagerId: string
): Promise<AgentRosterEntry[]> {
  const [approvedIds, assignedIds] = await Promise.all([
    fetchQmApprovedAgentUserIds(qualityManagerId),
    fetchQmAssignedAgentUserIds(qualityManagerId),
  ]);

  const userIds = [...new Set([...approvedIds, ...assignedIds])];
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
      ...ACTIVE_USER_WHERE,
    },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const approvedSet = new Set(approvedIds);
  return users.map((user) => ({
    ...mapAgentUser(user),
    source: approvedSet.has(user.id) ? "provisioned" : "assigned",
  }));
}

/** Role-aware roster for a platform user (active agents only). */
export async function fetchAgentRosterEntries(
  userId: string,
  roleSlug: string
): Promise<AgentRosterEntry[]> {
  switch (roleSlug) {
    case SYSTEM_ROLE_SLUGS.SUPERVISOR:
      return fetchProvisionedAgentEntries(userId);

    case SYSTEM_ROLE_SLUGS.QUALITY_ANALYST:
      return mergeRosterEntries([
        ...(await fetchAssignedAgentEntries(userId)),
        ...(await fetchProvisionedAgentEntries(userId)),
      ]);

    case SYSTEM_ROLE_SLUGS.QUALITY_MANAGER:
      return fetchQmAgentEntries(userId);

    default:
      return [];
  }
}

export async function fetchAgentRosterNames(
  userId: string,
  roleSlug: string
): Promise<string[]> {
  const entries = await fetchAgentRosterEntries(userId, roleSlug);
  return entries.map((entry) => entry.name);
}

export async function fetchAgentRosterIds(
  userId: string,
  roleSlug: string
): Promise<string[]> {
  const entries = await fetchAgentRosterEntries(userId, roleSlug);
  return entries.map((entry) => entry.id);
}

/** Agents provisioned by a supervisor — audit-form supervisor → agent mapping. */
export async function fetchSupervisorProvisionedAgentNames(
  supervisorUserId: string
): Promise<string[]> {
  const entries = await fetchProvisionedAgentEntries(supervisorUserId);
  return entries.map((entry) => entry.name);
}

/** Batch: supervisor user id → active agent display names they provisioned. */
export async function fetchProvisionedAgentNamesBySupervisorUserIds(
  supervisorUserIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const id of supervisorUserIds) {
    map.set(id, []);
  }
  if (supervisorUserIds.length === 0) return map;

  const agents = await prisma.user.findMany({
    where: withActiveUserFilter({
      createdById: { in: supervisorUserIds },
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
    }),
    select: { name: true, email: true, createdById: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  for (const agent of agents) {
    if (!agent.createdById) continue;
    const list = map.get(agent.createdById) ?? [];
    list.push(resolveRoleUserName(agent));
    map.set(agent.createdById, list);
  }

  return map;
}

export function normalizeAgentDisplayName(name: string): string {
  return name.trim().toLowerCase();
}

export function agentNameInVisibleSet(
  agentName: string,
  visibleNames: string[]
): boolean {
  const key = normalizeAgentDisplayName(agentName);
  return visibleNames.some(
    (visible) => normalizeAgentDisplayName(visible) === key
  );
}

export function filterAgentNamesToVisibleSet(
  agentNames: string[],
  visibleNames: string[]
): string[] {
  return agentNames.filter((name) => agentNameInVisibleSet(name, visibleNames));
}

export async function fetchAgentAssigneeEntries(
  agentUserId: string
): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    roleName: string;
    roleSlug: string;
  }>
> {
  const rows = await prisma.agentAssignment.findMany({
    where: { agentId: agentUserId },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          approvalStatus: true,
          role: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      roleName: string;
      roleSlug: string;
    }
  >();

  for (const row of rows) {
    if (!isLoginEligibleUser(row.assignedTo)) continue;
    if (row.assignedTo.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) continue;
    byId.set(row.assignedTo.id, {
      id: row.assignedTo.id,
      name: resolveRoleUserName(row.assignedTo),
      email: row.assignedTo.email,
      roleName: row.assignedTo.role.name,
      roleSlug: row.assignedTo.role.slug,
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSupervisorNamesForAgentUserIds(
  agentUserIds: string[]
): Promise<string[]> {
  if (agentUserIds.length === 0) return [];

  const agents = await prisma.user.findMany({
    where: { id: { in: agentUserIds } },
    select: {
      createdBy: {
        select: {
          name: true,
          email: true,
          isActive: true,
          approvalStatus: true,
          role: { select: { slug: true } },
        },
      },
    },
  });

  const names = new Set<string>();
  for (const agent of agents) {
    const supervisor = agent.createdBy;
    if (
      supervisor?.role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR &&
      isLoginEligibleUser(supervisor)
    ) {
      names.add(resolveRoleUserName(supervisor));
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
