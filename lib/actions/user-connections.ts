"use server";

import type { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  fetchAgentRosterEntries,
  fetchProvisionedAgentEntriesBySupervisorUserIds,
} from "@/lib/audit/agent-roster";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  canAssignAgents,
  canManageUsers,
  canViewUserConnections,
  isSuperAdmin,
  type SessionRole,
} from "@/lib/rbac";
import { isLoginEligibleUser } from "@/lib/user-active-filter";
import { buildManagedUsersWhere } from "@/lib/user-roster-scope";

export type ConnectedPerson = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleSlug: string;
};

export type CreatedUsersByRole = {
  roleSlug: string;
  roleName: string;
  count: number;
};

export type ConnectedUserRow = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleSlug: string;
  isActive: boolean;
  approvalStatus: string;
  createdBy: ConnectedPerson | null;
  assignedAgents: ConnectedPerson[];
  assignedTo: ConnectedPerson[];
  createdUsers: CreatedUsersByRole[];
  createdUsersTotal: number;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  approvalStatus: true,
  createdById: true,
  role: { select: { name: true, slug: true } },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true, slug: true } },
    },
  },
} as const;

function toPerson(user: {
  id: string;
  name: string | null;
  email: string;
  role: { name: string; slug: string };
}): ConnectedPerson {
  return {
    id: user.id,
    name: resolveRoleUserName(user),
    email: user.email,
    roleName: user.role.name,
    roleSlug: user.role.slug,
  };
}

function rosterEntryToAgentPerson(entry: {
  id: string;
  name: string;
  email: string;
}): ConnectedPerson {
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email,
    roleName: "Agent",
    roleSlug: SYSTEM_ROLE_SLUGS.AGENT,
  };
}

async function resolveVisibleUserWhere(
  userId: string,
  role: SessionRole
): Promise<Prisma.UserWhereInput | null> {
  if (canManageUsers(role) || isSuperAdmin(role)) {
    return {};
  }

  if (!canViewUserConnections(role)) {
    return null;
  }

  const managedWhere = await buildManagedUsersWhere(userId, role);
  const managedUsers = await prisma.user.findMany({
    where: managedWhere,
    select: { id: true },
  });
  const seedIds = new Set(managedUsers.map((user) => user.id));
  seedIds.add(userId);

  if (canAssignAgents(role)) {
    const [assignments, qualityAnalysts] = await Promise.all([
      prisma.agentAssignment.findMany({
        where: { assignedById: userId },
        select: { agentId: true, assignedToId: true },
      }),
      prisma.user.findMany({
        where: { role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST } },
        select: { id: true },
      }),
    ]);

    for (const row of assignments) {
      seedIds.add(row.agentId);
      seedIds.add(row.assignedToId);
    }
    for (const qa of qualityAnalysts) {
      seedIds.add(qa.id);
    }
  }

  const relatedAssignments = await prisma.agentAssignment.findMany({
    where: {
      OR: [
        { agentId: { in: [...seedIds] } },
        { assignedToId: { in: [...seedIds] } },
      ],
    },
    select: { agentId: true, assignedToId: true, assignedById: true },
  });

  for (const row of relatedAssignments) {
    seedIds.add(row.agentId);
    seedIds.add(row.assignedToId);
    seedIds.add(row.assignedById);
  }

  const withCreators = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: [...seedIds] } },
        { createdById: { in: [...seedIds] } },
      ],
    },
    select: { id: true, createdById: true },
  });

  for (const user of withCreators) {
    seedIds.add(user.id);
    if (user.createdById) seedIds.add(user.createdById);
  }

  return { id: { in: [...seedIds] } };
}

export async function getConnectedUsersOverview(): Promise<ConnectedUserRow[]> {
  const session = await requireAuth();
  const role = session.user.role;

  if (!canViewUserConnections(role)) {
    return [];
  }

  const userWhere = await resolveVisibleUserWhere(session.user.id, role);
  if (userWhere === null) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: userSelect,
    orderBy: [{ role: { name: "asc" } }, { name: "asc" }, { email: "asc" }],
  });

  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) {
    return [];
  }

  const [createdGroups, roles] = await Promise.all([
    prisma.user.groupBy({
      by: ["createdById", "roleId"],
      where: { createdById: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.role.findMany({
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const roleById = new Map(roles.map((item) => [item.id, item]));

  // Batch roster + assignment lookups (avoid N+1 across hundreds of users).
  const supervisorIds = users
    .filter((user) =>
      user.role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
      user.role.slug === SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR
    )
    .map((user) => user.id);
  const qaIds = users
    .filter((user) => user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST)
    .map((user) => user.id);
  const qmIds = users
    .filter((user) => user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER)
    .map((user) => user.id);
  const agentIds = users
    .filter((user) => user.role.slug === SYSTEM_ROLE_SLUGS.AGENT)
    .map((user) => user.id);

  const [provisionedBySupervisor, assignmentRows] = await Promise.all([
    fetchProvisionedAgentEntriesBySupervisorUserIds([
      ...supervisorIds,
      ...qaIds,
    ]),
    agentIds.length > 0
      ? prisma.agentAssignment.findMany({
          where: { agentId: { in: agentIds } },
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
        })
      : Promise.resolve([]),
  ]);

  const rosterByUserId = new Map<string, ConnectedPerson[]>();
  for (const id of supervisorIds) {
    rosterByUserId.set(
      id,
      (provisionedBySupervisor.get(id) ?? []).map(rosterEntryToAgentPerson)
    );
  }

  // QA: assigned + provisioned (still one query per QA for assignments — bounded).
  await Promise.all(
    qaIds.map(async (qaId) => {
      const entries = await fetchAgentRosterEntries(
        qaId,
        SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
      );
      rosterByUserId.set(qaId, entries.map(rosterEntryToAgentPerson));
    })
  );

  await Promise.all(
    qmIds.map(async (qmId) => {
      const entries = await fetchAgentRosterEntries(
        qmId,
        SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
      );
      rosterByUserId.set(qmId, entries.map(rosterEntryToAgentPerson));
    })
  );

  const assigneesByAgent = new Map<string, ConnectedPerson[]>();
  for (const row of assignmentRows) {
    if (!isLoginEligibleUser(row.assignedTo)) continue;
    const list = assigneesByAgent.get(row.agentId) ?? [];
    list.push({
      id: row.assignedTo.id,
      name: resolveRoleUserName(row.assignedTo),
      email: row.assignedTo.email,
      roleName: row.assignedTo.role.name,
      roleSlug: row.assignedTo.role.slug,
    });
    assigneesByAgent.set(row.agentId, list);
  }

  const createdByRole = new Map<string, CreatedUsersByRole[]>();
  for (const group of createdGroups) {
    if (!group.createdById) continue;
    const roleMeta = roleById.get(group.roleId);
    if (!roleMeta) continue;

    const rows = createdByRole.get(group.createdById) ?? [];
    rows.push({
      roleSlug: roleMeta.slug,
      roleName: roleMeta.name,
      count: group._count._all,
    });
    createdByRole.set(group.createdById, rows);
  }

  for (const [, rows] of createdByRole) {
    rows.sort((a, b) => a.roleName.localeCompare(b.roleName));
  }

  return users.map((user) => {
    const createdUsers = createdByRole.get(user.id) ?? [];
    const createdUsersTotal = createdUsers.reduce(
      (sum, item) => sum + item.count,
      0
    );

    return {
      id: user.id,
      name: resolveRoleUserName(user),
      email: user.email,
      roleName: user.role.name,
      roleSlug: user.role.slug,
      isActive: user.isActive,
      approvalStatus: user.approvalStatus,
      createdBy: user.createdBy ? toPerson(user.createdBy) : null,
      assignedAgents: rosterByUserId.get(user.id) ?? [],
      assignedTo: assigneesByAgent.get(user.id) ?? [],
      createdUsers,
      createdUsersTotal,
    };
  });
}
