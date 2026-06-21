import { cache } from "react";
import { fetchSupervisorTierVisibleAgentNames } from "@/lib/audit/agent-assignment-scope";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { withActiveUserFilter } from "@/lib/user-active-filter";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const fetchManagedAgentNames = cache(async (creatorId: string) => {
  return fetchSupervisorTierVisibleAgentNames(creatorId);
});

export const fetchManagedAnalystNames = cache(async (creatorId: string) => {
  const users = await prisma.user.findMany({
    where: withActiveUserFilter({
      createdById: creatorId,
      role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST },
    }),
    select: { name: true, email: true },
  });

  return users.map((user) => resolveRoleUserName(user));
});
