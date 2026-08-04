"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-guards";
import {
  fetchMemberAccessGrants,
  type MemberAccessGrantRecord,
} from "@/lib/audit/member-access";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { invalidateAuditCaches, invalidateUserCaches } from "@/lib/invalidate-cache";
import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canManageMemberAccess, isSuperAdmin } from "@/lib/rbac";
import {
  ACTIVE_USER_WHERE,
  withActiveUserFilter,
} from "@/lib/user-active-filter";

const grantSchema = z.object({
  memberId: z.string().min(1),
  targetUserId: z.string().min(1),
});

const bulkGrantSchema = z.object({
  memberId: z.string().min(1),
  targetUserIds: z.array(z.string().min(1)).min(1, "Select at least one user."),
});

const revokeSchema = z.object({
  grantId: z.string().min(1),
});

function revalidateMemberAccessPaths(memberId: string) {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");
  invalidateAuditCaches(memberId);
  invalidateUserCaches(memberId);
}

async function assertCanManageMemberAccess() {
  const session = await requireAuth();
  if (!canManageMemberAccess(session.user.role)) {
    return { error: "Only Quality Managers and Superadmin can manage Member access." as const };
  }
  return { session };
}

async function assertActiveMember(memberId: string) {
  return prisma.user.findFirst({
    where: withActiveUserFilter({
      id: memberId,
      role: { slug: SYSTEM_ROLE_SLUGS.MEMBER },
    }),
    select: { id: true, name: true, email: true },
  });
}

async function assertGrantableTarget(targetUserId: string) {
  return prisma.user.findFirst({
    where: withActiveUserFilter({
      id: targetUserId,
      role: {
        slug: {
          in: [SYSTEM_ROLE_SLUGS.AGENT, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST],
        },
      },
    }),
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { slug: true, name: true } },
    },
  });
}

export type MemberOptionRow = {
  id: string;
  name: string;
  email: string;
};

export type GrantableTargetRow = {
  id: string;
  name: string;
  email: string;
  roleSlug: string;
  roleName: string;
};

const EMPTY_MEMBER_ACCESS_PANEL = {
  members: [] as MemberOptionRow[],
  grantableTargets: [] as GrantableTargetRow[],
  grantsByMemberId: {} as Record<string, MemberAccessGrantRecord[]>,
};

export async function getMemberAccessPanelData(): Promise<{
  members: MemberOptionRow[];
  grantableTargets: GrantableTargetRow[];
  grantsByMemberId: Record<string, MemberAccessGrantRecord[]>;
}> {
  try {
    await requirePermission(PERMISSIONS.USERS_MEMBER_ACCESS);
    const gate = await assertCanManageMemberAccess();
    if ("error" in gate) {
      return EMPTY_MEMBER_ACCESS_PANEL;
    }

    const [members, grantableTargets, allGrants] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: { slug: SYSTEM_ROLE_SLUGS.MEMBER },
          ...ACTIVE_USER_WHERE,
        },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      prisma.user.findMany({
        where: {
          role: {
            slug: {
              in: [SYSTEM_ROLE_SLUGS.AGENT, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST],
            },
          },
          ...ACTIVE_USER_WHERE,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { slug: true, name: true } },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      prisma.memberAccessGrant.findMany({
        select: { memberId: true },
      }),
    ]);

    const memberIds = [...new Set(allGrants.map((g) => g.memberId))];
    const grantsByMemberId: Record<string, MemberAccessGrantRecord[]> = {};
    await Promise.all(
      memberIds.map(async (memberId) => {
        grantsByMemberId[memberId] = await fetchMemberAccessGrants(memberId);
      })
    );

    for (const member of members) {
      grantsByMemberId[member.id] ??= [];
    }

    return {
      members: members.map((user) => ({
        id: user.id,
        name: resolveRoleUserName(user),
        email: user.email,
      })),
      grantableTargets: grantableTargets.map((user) => ({
        id: user.id,
        name: resolveRoleUserName(user),
        email: user.email,
        roleSlug: user.role.slug,
        roleName: user.role.name,
      })),
      grantsByMemberId,
    };
  } catch (error) {
    // Never take down Settings → Team if member-access is unavailable.
    console.error("[member-access] panel data failed:", error);
    return EMPTY_MEMBER_ACCESS_PANEL;
  }
}

export async function grantMemberAccess(memberId: string, targetUserId: string) {
  await requirePermission(PERMISSIONS.USERS_MEMBER_ACCESS);
  const gate = await assertCanManageMemberAccess();
  if ("error" in gate) return { error: gate.error };
  const session = gate.session;

  const parsed = grantSchema.safeParse({ memberId, targetUserId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const member = await assertActiveMember(parsed.data.memberId);
  if (!member) return { error: "Member not found or not active." };

  const target = await assertGrantableTarget(parsed.data.targetUserId);
  if (!target) {
    return { error: "Target must be an active Agent or Quality Analyst." };
  }

  try {
    await prisma.memberAccessGrant.create({
      data: {
        memberId: member.id,
        targetUserId: target.id,
        grantedById: session.user.id,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { error: "That access is already granted." };
    }
    throw error;
  }

  revalidateMemberAccessPaths(member.id);
  return {
    success: true,
    message: `Granted ${target.role.name} access for ${resolveRoleUserName(target)}.`,
  };
}

export async function bulkGrantMemberAccess(
  memberId: string,
  targetUserIds: string[]
) {
  await requirePermission(PERMISSIONS.USERS_MEMBER_ACCESS);
  const gate = await assertCanManageMemberAccess();
  if ("error" in gate) return { error: gate.error };
  const session = gate.session;

  const parsed = bulkGrantSchema.safeParse({ memberId, targetUserIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const member = await assertActiveMember(parsed.data.memberId);
  if (!member) return { error: "Member not found or not active." };

  const targets = await prisma.user.findMany({
    where: withActiveUserFilter({
      id: { in: parsed.data.targetUserIds },
      role: {
        slug: {
          in: [SYSTEM_ROLE_SLUGS.AGENT, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST],
        },
      },
    }),
    select: { id: true },
  });

  if (targets.length === 0) {
    return { error: "No valid Agent or Quality Analyst targets selected." };
  }

  let created = 0;
  for (const target of targets) {
    try {
      await prisma.memberAccessGrant.create({
        data: {
          memberId: member.id,
          targetUserId: target.id,
          grantedById: session.user.id,
        },
      });
      created += 1;
    } catch (error) {
      if (isPrismaUniqueViolation(error)) continue;
      throw error;
    }
  }

  revalidateMemberAccessPaths(member.id);
  return {
    success: true,
    message:
      created === 0
        ? "Selected users already have access."
        : `Granted access to ${created} user${created === 1 ? "" : "s"}.`,
  };
}

export async function revokeMemberAccess(grantId: string) {
  await requirePermission(PERMISSIONS.USERS_MEMBER_ACCESS);
  const gate = await assertCanManageMemberAccess();
  if ("error" in gate) return { error: gate.error };

  const parsed = revokeSchema.safeParse({ grantId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.memberAccessGrant.findUnique({
    where: { id: parsed.data.grantId },
    select: { id: true, memberId: true, grantedById: true },
  });
  if (!existing) return { error: "Access grant not found." };

  // QM can revoke any grant (full CRUD). Superadmin same.
  if (
    !isSuperAdmin(gate.session.user.role) &&
    gate.session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  ) {
    return { error: "You cannot revoke this grant." };
  }

  await prisma.memberAccessGrant.delete({ where: { id: existing.id } });
  revalidateMemberAccessPaths(existing.memberId);
  return { success: true, message: "Access revoked." };
}
