import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

export const fetchManagedAgentNames = cache(async (creatorId: string) => {
  const users = await prisma.user.findMany({
    where: {
      createdById: creatorId,
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
    },
    select: { name: true, email: true },
  });

  return users.map((user) => resolveRoleUserName(user));
});

export const fetchManagedAnalystNames = cache(async (creatorId: string) => {
  const users = await prisma.user.findMany({
    where: {
      createdById: creatorId,
      role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST },
    },
    select: { name: true, email: true },
  });

  return users.map((user) => resolveRoleUserName(user));
});
