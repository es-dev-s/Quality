import { prisma } from "@/lib/prisma";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

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
      agent: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => resolveRoleUserName(row.agent));
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
      isActive: true,
      approvalStatus: "ACTIVE",
    },
    select: { name: true, email: true },
  });

  return users.map((user) => resolveRoleUserName(user));
}

export async function fetchSupervisorTierVisibleAgentNames(userId: string) {
  const [created, assigned] = await Promise.all([
    prisma.user.findMany({
      where: {
        createdById: userId,
        role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
        approvalStatus: "ACTIVE",
        isActive: true,
      },
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
    if (row.agent.isActive && row.agent.approvalStatus === "ACTIVE") {
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
            role: { select: { slug: true } },
          },
        },
      },
    }),
  ]);

  const names = new Set<string>();
  for (const agent of agents) {
    if (agent.createdBy?.role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR) {
      names.add(resolveRoleUserName(agent.createdBy));
    }
  }
  for (const row of assignments) {
    if (row.assignedTo.role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR) {
      names.add(resolveRoleUserName(row.assignedTo));
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
    return [...new Set([...approvedIds, ...assignedIds])];
  }

  if (
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    const [created, assigned] = await Promise.all([
      prisma.user.findMany({
        where: {
          createdById: userId,
          role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
          approvalStatus: "ACTIVE",
          isActive: true,
        },
        select: { id: true },
      }),
      fetchAssignedAgentUserIds(userId),
    ]);
    return [...new Set([...created.map((u) => u.id), ...assigned])];
  }

  return [];
}
