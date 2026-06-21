import { prisma } from "@/lib/prisma";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { ACTIVE_USER_WHERE, isLoginEligibleUser, withActiveUserFilter } from "@/lib/user-active-filter";

export async function fetchAssignedAgentUserIds(assignedToId: string) {
  const rows = await prisma.agentAssignment.findMany({
    where: { assignedToId },
    select: { agentId: true },
  });
  return rows.map((row) => row.agentId);
}

export async function fetchAssignedAgentNames(assignedToId: string) {
  const rows = await prisma.agentAssignment.findMany({
    where: { assignedToId },
    include: {
      agent: {
        select: {
          name: true,
          email: true,
          isActive: true,
          approvalStatus: true,
        },
      },
    },
  });
  return rows
    .filter((row) => isLoginEligibleUser(row.agent))
    .map((row) => resolveRoleUserName(row.agent));
}

export async function fetchQmApprovedAgentUserIds(qualityManagerId: string) {
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

export async function fetchQmAssignedAgentUserIds(qualityManagerId: string) {
  const rows = await prisma.agentAssignment.findMany({
    where: { assignedById: qualityManagerId },
    select: { agentId: true },
  });
  return [...new Set(rows.map((row) => row.agentId))];
}

export async function fetchQmVisibleAgentNames(qualityManagerId: string) {
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
    select: { name: true, email: true },
  });

  return users.map((user) => resolveRoleUserName(user));
}

export async function fetchSupervisorTierVisibleAgentNames(userId: string) {
  const [created, assigned] = await Promise.all([
    prisma.user.findMany({
      where: withActiveUserFilter({
        createdById: userId,
        role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
      }),
      select: { name: true, email: true },
    }),
    prisma.agentAssignment.findMany({
      where: { assignedToId: userId },
      include: {
        agent: {
          select: {
            name: true,
            email: true,
            approvalStatus: true,
            isActive: true,
          },
        },
      },
    }),
  ]);

  const names = new Set<string>();
  for (const user of created) {
    names.add(resolveRoleUserName(user));
  }
  for (const row of assigned) {
    if (isLoginEligibleUser(row.agent)) {
      names.add(resolveRoleUserName(row.agent));
    }
  }
  return [...names];
}

export async function fetchSupervisorNamesForAgentUserIds(
  agentUserIds: string[]
): Promise<string[]> {
  if (agentUserIds.length === 0) return [];

  const [agents, assignments] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.agentAssignment.findMany({
      where: { agentId: { in: agentUserIds } },
      include: {
        assignedTo: {
          select: {
            name: true,
            email: true,
            isActive: true,
            approvalStatus: true,
            role: { select: { slug: true } },
          },
        },
      },
    }),
  ]);

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
  for (const row of assignments) {
    const supervisor = row.assignedTo;
    if (
      supervisor.role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR &&
      isLoginEligibleUser(supervisor)
    ) {
      names.add(resolveRoleUserName(supervisor));
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export async function fetchVisibleAgentUserIds(
  userId: string,
  roleSlug: string
): Promise<string[]> {
  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const [approvedIds, assignedIds] = await Promise.all([
      fetchQmApprovedAgentUserIds(userId),
      fetchQmAssignedAgentUserIds(userId),
    ]);
    const userIds = [...new Set([...approvedIds, ...assignedIds])];
    if (userIds.length === 0) return [];

    const activeAgents = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
        ...ACTIVE_USER_WHERE,
      },
      select: { id: true },
    });
    return activeAgents.map((user) => user.id);
  }

  if (
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    const [created, assignedRows] = await Promise.all([
      prisma.user.findMany({
        where: withActiveUserFilter({
          createdById: userId,
          role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
        }),
        select: { id: true },
      }),
      prisma.agentAssignment.findMany({
        where: { assignedToId: userId },
        include: {
          agent: {
            select: { id: true, isActive: true, approvalStatus: true },
          },
        },
      }),
    ]);
    const ids = new Set(created.map((user) => user.id));
    for (const row of assignedRows) {
      if (isLoginEligibleUser(row.agent)) {
        ids.add(row.agent.id);
      }
    }
    return [...ids];
  }

  return [];
}
