import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { withActiveUserFilter } from "@/lib/user-active-filter";

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
  profileName: string | null;
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
  const profileName = user.name?.trim() || null;
  return {
    id: user.id,
    name: resolveRoleUserName(user),
    email: user.email,
    profileName,
    hasProfileName: Boolean(profileName),
    dateOfJoining: user.dateOfJoining,
    roleSlug: user.role.slug,
    roleName: user.role.name,
    createdAt: user.createdAt,
  };
}

export type FetchRoleUsersOptions = {
  /** Include deactivated / non-approved users (admin management tables only). */
  includeInactive?: boolean;
};

export const fetchUsersByRoleSlugs = cache(
  async (
    slugs: SystemRoleSlug[],
    options: FetchRoleUsersOptions = {}
  ): Promise<RoleUserRecord[]> => {
    if (slugs.length === 0) return [];

    const roleFilter = { role: { slug: { in: slugs } } };
    const where = options.includeInactive
      ? roleFilter
      : withActiveUserFilter(roleFilter);

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    return users.map(mapRoleUser);
  }
);

export async function fetchAgentRoleUsers(
  options: FetchRoleUsersOptions = {}
): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.AGENT], options);
}

export async function fetchSupervisorRoleUsers(
  options: FetchRoleUsersOptions = {}
): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.SUPERVISOR], options);
}

export async function fetchQualityAnalystRoleUsers(
  options: FetchRoleUsersOptions = {}
): Promise<RoleUserRecord[]> {
  return fetchUsersByRoleSlugs([SYSTEM_ROLE_SLUGS.QUALITY_ANALYST], options);
}

/** @deprecated Use fetchQualityAnalystRoleUsers */
export async function fetchAuditorRoleUsers(
  options: FetchRoleUsersOptions = {}
): Promise<RoleUserRecord[]> {
  return fetchQualityAnalystRoleUsers(options);
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
