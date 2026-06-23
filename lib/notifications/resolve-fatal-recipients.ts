import { normalizeAgentName } from "@/lib/audit/agent-name";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { withActiveUserFilter } from "@/lib/user-active-filter";
import type { FatalRecipientRole } from "@/lib/notifications/types";

export type FatalAuditRecipientContext = {
  agent: string;
  supervisor: string | null;
  excludeUserId: string;
};

export type FatalAuditRecipient = {
  userId: string;
  role: FatalRecipientRole;
};

function normalizeDisplayName(value: string): string {
  return value.trim().toLowerCase();
}

function userMatchesDisplayName(
  user: { name: string | null; email: string },
  displayName: string
): boolean {
  const target = normalizeDisplayName(displayName);
  if (!target) return false;

  const candidates = [
    resolveRoleUserName(user),
    user.name?.trim() ?? "",
    user.email.trim(),
    user.email.trim().toLowerCase(),
  ];

  return candidates.some(
    (candidate) => candidate && normalizeDisplayName(candidate) === target
  );
}

async function findActiveUserIdByRoleAndName(
  roleSlug: string,
  displayName: string | null | undefined
): Promise<string | null> {
  const trimmed = displayName?.trim();
  if (!trimmed) return null;

  const users = await prisma.user.findMany({
    where: withActiveUserFilter({ role: { slug: roleSlug } }),
    select: { id: true, name: true, email: true },
  });

  const match = users.find((user) => userMatchesDisplayName(user, trimmed));
  return match?.id ?? null;
}

async function findAgentUserId(agentName: string): Promise<string | null> {
  const direct = await findActiveUserIdByRoleAndName(
    SYSTEM_ROLE_SLUGS.AGENT,
    agentName
  );
  if (direct) return direct;

  const { nameKey } = normalizeAgentName(agentName);
  const rosterRow = await prisma.agent.findFirst({
    where: { nameKey },
    select: { name: true },
  });
  if (!rosterRow?.name) return null;

  return findActiveUserIdByRoleAndName(SYSTEM_ROLE_SLUGS.AGENT, rosterRow.name);
}

async function findManagerUserIdsForAgent(agentUserId: string): Promise<string[]> {
  const managerIds = new Set<string>();

  const assignments = await prisma.agentAssignment.findMany({
    where: { agentId: agentUserId },
    select: { assignedById: true },
  });
  for (const row of assignments) {
    managerIds.add(row.assignedById);
  }

  const approval = await prisma.userProvisioningRequest.findFirst({
    where: {
      createdUserId: agentUserId,
      status: "APPROVED",
      targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
      reviewedById: { not: null },
    },
    orderBy: { reviewedAt: "desc" },
    select: { reviewedById: true },
  });
  if (approval?.reviewedById) {
    managerIds.add(approval.reviewedById);
  }

  if (managerIds.size === 0) return [];

  const managers = await prisma.user.findMany({
    where: withActiveUserFilter({
      id: { in: [...managerIds] },
      role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER },
    }),
    select: { id: true },
  });

  return managers.map((user) => user.id);
}

/** Agent, supervisor, and aligned quality managers for a fatal audit. */
export async function resolveFatalAuditRecipients(
  ctx: FatalAuditRecipientContext
): Promise<FatalAuditRecipient[]> {
  const recipients = new Map<string, FatalRecipientRole>();

  const agentUserId = await findAgentUserId(ctx.agent);
  if (agentUserId && agentUserId !== ctx.excludeUserId) {
    recipients.set(agentUserId, "agent");
  }

  const supervisorUserId = await findActiveUserIdByRoleAndName(
    SYSTEM_ROLE_SLUGS.SUPERVISOR,
    ctx.supervisor
  );
  if (supervisorUserId && supervisorUserId !== ctx.excludeUserId) {
    recipients.set(supervisorUserId, "supervisor");
  }

  if (agentUserId) {
    const managerIds = await findManagerUserIdsForAgent(agentUserId);
    for (const managerId of managerIds) {
      if (managerId !== ctx.excludeUserId) {
        recipients.set(managerId, "manager");
      }
    }
  }

  return [...recipients.entries()].map(([userId, role]) => ({ userId, role }));
}
