import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";

export function resolveRoleUserName(user: {
  name: string | null;
  email: string;
}): string {
  const trimmed = user.name?.trim();
  return trimmed || user.email;
}

export type RoleUserRecord = {
  id: string;
  name: string;
  email: string;
  hasProfileName: boolean;
  dateOfJoining: string | null;
  roleSlug: string;
  roleName: string;
  createdAt: Date;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  dateOfJoining: true,
  createdAt: true,
  role: { select: { slug: true, name: true } },
} as const;

function mapRoleUser(user: {
  id: string;
  name: string | null;
  email: string;
  dateOfJoining: string | null;
  createdAt: Date;
  role: { slug: string; name: string };
}): RoleUserRecord {
  return {
    id: user.id,
    name: resolveRoleUserName(user),
    email: user.email,
    hasProfileName: Boolean(user.name?.trim()),
    dateOfJoining: user.dateOfJoining,
    roleSlug: user.role.slug,
    roleName: user.role.name,
    createdAt: user.createdAt,
  };
}

export const fetchUsersByRoleSlugs = cache(
  async (slugs: SystemRoleSlug[]): Promise<RoleUserRecord[]> => {
    if (slugs.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { role: { slug: { in: slugs } } },
      select: userSelect,
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    return users.map(mapRoleUser);
  }
);

export async function fetchAgentRoleUsers(): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.AGENT]);
}

export async function fetchSupervisorRoleUsers(): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.SUPERVISOR]);
}

export async function fetchQualityAnalystRoleUsers(): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]);
}

/** @deprecated Use fetchQualityAnalystRoleUsers */
export async function fetchAuditorRoleUsers(): Promise<RoleUserRecord[]> {
  return fetchQualityAnalystRoleUsers();
}

export async function fetchRoleUserNames(
  slugs: SystemRoleSlug[]
): Promise<string[]> {
  const users = await fetchUsersByRoleSlugs(slugs);
  return users.map((user) => user.name);
}

export async function fetchActiveAgentUserNames(): Promise<string[]> {
  return fetchRoleUserNames([SYSTEM_ROLE_SLUGS.AGENT]);
}

export async function fetchActiveSupervisorUserNames(): Promise<string[]> {
  return fetchRoleUserNames([SYSTEM_ROLE_SLUGS.SUPERVISOR]);
}

export async function fetchActiveQualityAnalystUserNames(): Promise<string[]> {
  return fetchRoleUserNames([SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]);
}

/** @deprecated Use fetchActiveQualityAnalystUserNames */
export async function fetchActiveAuditorUserNames(): Promise<string[]> {
  return fetchActiveQualityAnalystUserNames();
}

/** @deprecated Use resolveRoleUserName */
export const resolveAgentUserName = resolveRoleUserName;
