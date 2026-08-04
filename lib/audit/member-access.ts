import { prisma } from "@/lib/prisma";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { ACTIVE_USER_WHERE } from "@/lib/user-active-filter";

export type MemberAccessTargetRole =
  | typeof SYSTEM_ROLE_SLUGS.AGENT
  | typeof SYSTEM_ROLE_SLUGS.QUALITY_ANALYST;

export type MemberAccessGrantRecord = {
  id: string;
  targetUserId: string;
  targetName: string;
  targetEmail: string;
  targetRoleSlug: MemberAccessTargetRole;
  grantedById: string;
  grantedByName: string;
  createdAt: string;
};

export type MemberFeedbackMode = "none" | "agent" | "qa";

const GRANT_TARGET_SLUGS = [
  SYSTEM_ROLE_SLUGS.AGENT,
  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
] as const;

export async function fetchMemberAccessGrants(
  memberId: string
): Promise<MemberAccessGrantRecord[]> {
  const rows = await prisma.memberAccessGrant.findMany({
    where: {
      memberId,
      targetUser: {
        ...ACTIVE_USER_WHERE,
        role: { slug: { in: [...GRANT_TARGET_SLUGS] } },
      },
    },
    include: {
      targetUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { slug: true } },
        },
      },
      grantedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows
    .filter(
      (row): row is typeof row & {
        targetUser: {
          role: { slug: MemberAccessTargetRole };
        };
      } =>
        row.targetUser.role.slug === SYSTEM_ROLE_SLUGS.AGENT ||
        row.targetUser.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
    )
    .map((row) => ({
      id: row.id,
      targetUserId: row.targetUser.id,
      targetName: resolveRoleUserName(row.targetUser),
      targetEmail: row.targetUser.email,
      targetRoleSlug: row.targetUser.role.slug,
      grantedById: row.grantedBy.id,
      grantedByName: resolveRoleUserName(row.grantedBy),
      createdAt: row.createdAt.toISOString(),
    }));
}

export async function fetchMemberGrantedTargetUserIds(
  memberId: string
): Promise<{ agentIds: string[]; qaIds: string[] }> {
  const grants = await fetchMemberAccessGrants(memberId);
  return {
    agentIds: grants
      .filter((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT)
      .map((g) => g.targetUserId),
    qaIds: grants
      .filter((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST)
      .map((g) => g.targetUserId),
  };
}

export async function resolveMemberFeedbackMode(
  memberId: string
): Promise<MemberFeedbackMode> {
  const { agentIds, qaIds } = await fetchMemberGrantedTargetUserIds(memberId);
  if (qaIds.length > 0) return "qa";
  if (agentIds.length > 0) return "agent";
  return "none";
}

export async function fetchMemberGrantedAgentNames(
  memberId: string
): Promise<string[]> {
  const grants = await fetchMemberAccessGrants(memberId);
  return grants
    .filter((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT)
    .map((g) => g.targetName)
    .sort((a, b) => a.localeCompare(b));
}

export async function fetchMemberGrantedQaNames(
  memberId: string
): Promise<string[]> {
  const grants = await fetchMemberAccessGrants(memberId);
  return grants
    .filter((g) => g.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST)
    .map((g) => g.targetName)
    .sort((a, b) => a.localeCompare(b));
}
