"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-guards";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import {
  fetchQmApprovedAgentUserIds,
  fetchQmAssignedAgentUserIds,
  fetchSupervisorTierVisibleAgentNames,
} from "@/lib/audit/agent-assignment-scope";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSuperAdmin, type SessionRole } from "@/lib/rbac";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { invalidateAgentAssignmentCaches } from "@/lib/invalidate-cache";
import { ACTIVE_USER_WHERE, isLoginEligibleUser, withActiveUserFilter } from "@/lib/user-active-filter";

const assignSchema = z.object({
  agentId: z.string().min(1),
  assignToUserId: z.string().min(1),
});

const bulkAssignSchema = z.object({
  agentIds: z.array(z.string().min(1)).min(1, "Select at least one agent."),
  assignToUserId: z.string().min(1),
});

function revalidateAssignmentPaths() {
  revalidatePath("/settings");
  revalidatePath("/audit-logs");
  revalidatePath("/dashboard");
}

async function assertQmCanManageAgent(
  agentId: string,
  actorId: string,
  actorRole: SessionRole
) {
  const agent = await prisma.user.findFirst({
    where: withActiveUserFilter({
      id: agentId,
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
    }),
    select: { id: true },
  });
  if (!agent) {
    return "Agent not found or not active.";
  }

  if (isSuperAdmin(actorRole)) {
    return null;
  }

  const approved = await prisma.userProvisioningRequest.findFirst({
    where: {
      createdUserId: agentId,
      reviewedById: actorId,
      status: "APPROVED",
      targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
    },
    select: { id: true },
  });

  const alreadyAssigned = await prisma.agentAssignment.findFirst({
    where: { agentId, assignedById: actorId },
    select: { id: true },
  });

  if (!approved && !alreadyAssigned) {
    return "You can only assign agents you approved or already manage.";
  }

  return null;
}

async function assertAssigneeIsQualityAnalyst(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      approvalStatus: true,
      role: { select: { slug: true } },
    },
  });
  if (!user) return "Assignee not found.";
  if (user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return "Agents can only be assigned to Quality Analyst users.";
  }
  if (!isLoginEligibleUser(user)) {
    return "Assignee is not an active Quality Analyst.";
  }
  return null;
}

export async function assignAgentToUser(agentId: string, assignToUserId: string) {
  const session = await requirePermission(PERMISSIONS.AGENT_ASSIGN);

  const parsed = assignSchema.safeParse({ agentId, assignToUserId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid assignment." };
  }

  const agentError = await assertQmCanManageAgent(
    parsed.data.agentId,
    session.user.id,
    session.user.role
  );
  if (agentError) return { error: agentError };

  const assigneeError = await assertAssigneeIsQualityAnalyst(
    parsed.data.assignToUserId
  );
  if (assigneeError) return { error: assigneeError };

  try {
    await prisma.agentAssignment.create({
      data: {
        agentId: parsed.data.agentId,
        assignedToId: parsed.data.assignToUserId,
        assignedById: session.user.id,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { error: "This agent is already assigned to that user." };
    }
    throw error;
  }

  revalidateAssignmentPaths();
  invalidateAgentAssignmentCaches(session.user.id, parsed.data.assignToUserId, {
    type: "agent:assigned",
    agentId: parsed.data.agentId,
    assignedToId: parsed.data.assignToUserId,
  });
  return { success: true as const };
}

export async function assignAgentsToUser(
  agentIds: string[],
  assignToUserId: string
) {
  const session = await requirePermission(PERMISSIONS.AGENT_ASSIGN);

  const parsed = bulkAssignSchema.safeParse({ agentIds, assignToUserId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid assignment." };
  }

  const uniqueAgentIds = [...new Set(parsed.data.agentIds)];

  const assigneeError = await assertAssigneeIsQualityAnalyst(
    parsed.data.assignToUserId
  );
  if (assigneeError) return { error: assigneeError };

  let assigned = 0;
  let skipped = 0;
  let firstError: string | null = null;

  for (const agentId of uniqueAgentIds) {
    const agentError = await assertQmCanManageAgent(
      agentId,
      session.user.id,
      session.user.role
    );
    if (agentError) {
      if (!firstError) firstError = agentError;
      skipped += 1;
      continue;
    }

    try {
      await prisma.agentAssignment.create({
        data: {
          agentId,
          assignedToId: parsed.data.assignToUserId,
          assignedById: session.user.id,
        },
      });
      assigned += 1;
      invalidateAgentAssignmentCaches(
        session.user.id,
        parsed.data.assignToUserId,
        {
          type: "agent:assigned",
          agentId,
          assignedToId: parsed.data.assignToUserId,
        }
      );
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  if (assigned === 0) {
    if (skipped > 0 && !firstError) {
      return {
        error: "All selected agents are already assigned to that analyst.",
      };
    }
    return { error: firstError ?? "No agents could be assigned." };
  }

  revalidateAssignmentPaths();
  return { success: true as const, assigned, skipped };
}

export async function removeAgentFromUser(
  agentId: string,
  assignToUserId: string
) {
  const session = await requirePermission(PERMISSIONS.AGENT_ASSIGN);

  const parsed = assignSchema.safeParse({ agentId, assignToUserId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid assignment." };
  }

  const existing = await prisma.agentAssignment.findUnique({
    where: {
      agentId_assignedToId: {
        agentId: parsed.data.agentId,
        assignedToId: parsed.data.assignToUserId,
      },
    },
    select: { assignedById: true },
  });

  if (!existing) {
    return { error: "Assignment not found." };
  }

  if (
    existing.assignedById !== session.user.id &&
    !isSuperAdmin(session.user.role)
  ) {
    return { error: "You can only remove assignments you created." };
  }

  await prisma.agentAssignment.delete({
    where: {
      agentId_assignedToId: {
        agentId: parsed.data.agentId,
        assignedToId: parsed.data.assignToUserId,
      },
    },
  });

  revalidateAssignmentPaths();
  invalidateAgentAssignmentCaches(session.user.id, parsed.data.assignToUserId, {
    type: "agent:unassigned",
    agentId: parsed.data.agentId,
    assignedToId: parsed.data.assignToUserId,
  });
  return { success: true as const };
}

export type MyAgentRow = {
  id: string;
  name: string;
  email: string;
  source: "created" | "assigned";
};

export async function getMyVisibleAgents(): Promise<MyAgentRow[]> {
  const session = await requireAuth();
  const slug = session.user.role.slug;

  if (
    slug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    const [createdUsers, assignedRows, names] = await Promise.all([
      prisma.user.findMany({
        where: {
          createdById: session.user.id,
          role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
          approvalStatus: "ACTIVE",
          isActive: true,
        },
        select: { id: true, name: true, email: true },
      }),
      prisma.agentAssignment.findMany({
        where: { assignedToId: session.user.id },
        include: {
          agent: { select: { id: true, name: true, email: true, isActive: true, approvalStatus: true } },
        },
      }),
      fetchSupervisorTierVisibleAgentNames(session.user.id),
    ]);

    const byId = new Map<string, MyAgentRow>();
    for (const user of createdUsers) {
      byId.set(user.id, {
        id: user.id,
        name: resolveRoleUserName(user),
        email: user.email,
        source: "created",
      });
    }
    for (const row of assignedRows) {
      if (!isLoginEligibleUser(row.agent)) continue;
      if (!byId.has(row.agent.id)) {
        byId.set(row.agent.id, {
          id: row.agent.id,
          name: resolveRoleUserName(row.agent),
          email: row.agent.email,
          source: "assigned",
        });
      }
    }

    // Ensure stable ordering aligned with visible names filter
    void names;
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const approvedIds = await fetchQmApprovedAgentUserIds(session.user.id);
    const assignedIds = await fetchQmAssignedAgentUserIds(session.user.id);
    const userIds = [...new Set([...approvedIds, ...assignedIds])];
    if (userIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        ...ACTIVE_USER_WHERE,
      },
      select: { id: true, name: true, email: true },
    });

    return users
      .map((user) => ({
        id: user.id,
        name: resolveRoleUserName(user),
        email: user.email,
        source: "created" as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return [];
}
