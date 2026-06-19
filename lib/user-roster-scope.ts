import type { Prisma } from "@prisma/client";
import {
  fetchQmApprovedAgentUserIds,
  fetchQmAssignedAgentUserIds,
} from "@/lib/audit/agent-assignment-scope";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import type { SessionRole } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function fetchQmScopedAgentUserIds(
  qualityManagerId: string
): Promise<string[]> {
  const [approvedIds, assignedIds] = await Promise.all([
    fetchQmApprovedAgentUserIds(qualityManagerId),
    fetchQmAssignedAgentUserIds(qualityManagerId),
  ]);
  return [...new Set([...approvedIds, ...assignedIds])];
}

export async function buildManagedUsersWhere(
  userId: string,
  role: SessionRole
): Promise<Prisma.UserWhereInput> {
  if (isSuperAdmin(role)) {
    return { createdById: userId };
  }

  if (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    const scopedAgentIds = await fetchQmScopedAgentUserIds(userId);
    return {
      OR: [
        { createdById: userId },
        ...(scopedAgentIds.length > 0
          ? [
              {
                id: { in: scopedAgentIds },
                role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
              },
            ]
          : []),
      ],
    };
  }

  return { createdById: userId };
}

export async function assertActorManagesUser(
  actorId: string,
  role: SessionRole,
  targetUserId: string
): Promise<string | null> {
  if (isSuperAdmin(role)) {
    return null;
  }

  const where = await buildManagedUsersWhere(actorId, role);

  const managed = await prisma.user.findFirst({
    where: { id: targetUserId, ...where },
    select: { id: true },
  });

  if (!managed) {
    return "You can only manage users within your team scope.";
  }

  return null;
}
