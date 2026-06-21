"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ForbiddenError, permissionError, requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS, isLegacySystemRole } from "@/lib/permissions";
import { canManageRoles, canManageUsers, hasScope, isSuperAdmin } from "@/lib/rbac";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { SUPERADMIN_ROLE_SLUG } from "@/lib/constants";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import {
  invalidateRoleCaches,
  invalidateUserCaches,
} from "@/lib/invalidate-cache";
import {
  SECURITY_AUDIT_ACTIONS,
  logSecurityAudit,
} from "@/lib/security-audit";
import { buildPasswordCredentials } from "@/lib/password-credentials";
import {
  decryptPassword,
  generateTemporaryPassword,
} from "@/lib/crypto/password-vault";

const isoDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)"),
  z.literal(""),
]).optional();

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  roleId: z.string().min(1, "Role is required"),
  dateOfJoining: isoDateSchema,
});

const updateUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().optional(),
  roleId: z.string().min(1, "Role is required"),
  dateOfJoining: isoDateSchema,
});

function normalizeJoiningDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateUserRosterPaths() {
  revalidateTag("interaction-config", "max");
  revalidatePath("/settings");
  revalidatePath("/forms/audit");
  revalidatePath("/forms");
  revalidatePath("/audit-logs");
  revalidatePath("/dashboard");
}

const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
});

const updateRoleSchema = createRoleSchema.extend({
  id: z.string(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function validateRoleAssignment(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { scopes: true } } },
  });
  if (!role) {
    return { error: "Selected role was not found." as const };
  }
  if (!role.isSystem && role._count.scopes === 0) {
    return {
      error:
        "This custom role has no module permissions. Assign a system role (Agent, Supervisor, etc.) or add scopes to the role first.",
    };
  }
  return { role };
}

function assertSuperAdminRoleAssignment(
  actor: Awaited<ReturnType<typeof requireAuth>>,
  targetRoleSlug: string
): { error: string } | null {
  if (isSuperAdmin(actor.user.role)) return null;
  if (
    targetRoleSlug === SUPERADMIN_ROLE_SLUG ||
    targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    isLegacySystemRole(targetRoleSlug)
  ) {
    return {
      error:
        "Only Super Admin can assign Super Admin, Quality Manager, or legacy Admin roles.",
    };
  }
  return null;
}

export async function getUsers() {
  await requirePermission(PERMISSIONS.ADMIN_USERS);
  return prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRoles() {
  await requirePermission(PERMISSIONS.ADMIN_ROLES);
  return prisma.role.findMany({
    include: {
      _count: { select: { users: true, scopes: true } },
      scopes: { include: { scope: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRolesForSelect() {
  const session = await requireAuth();
  if (
    !canManageUsers(session.user.role) &&
    !hasScope(session.user.role, PERMISSIONS.IMPORT_WRITE)
  ) {
    throw new ForbiddenError();
  }
  return prisma.role.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isSystem: true,
      _count: { select: { scopes: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function createUser(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.ADMIN_USERS);

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleId: formData.get("roleId"),
    dateOfJoining: formData.get("dateOfJoining") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with this email already exists" };
  }

  const pendingRequest = await prisma.userProvisioningRequest.findFirst({
    where: { email, status: "PENDING" },
    select: { id: true, targetRoleSlug: true },
  });
  if (pendingRequest) {
    return {
      error:
        "This email has a pending Team approval request. Approve or reject it under Settings → Team instead of creating the user directly.",
    };
  }

  const roleCheck = await validateRoleAssignment(parsed.data.roleId);
  if ("error" in roleCheck) {
    return { error: roleCheck.error };
  }

  const roleGuard = assertSuperAdminRoleAssignment(
    session,
    roleCheck.role.slug
  );
  if (roleGuard) return roleGuard;

  const dateOfJoining = normalizeJoiningDate(parsed.data.dateOfJoining);
  if (roleCheck.role.slug === SYSTEM_ROLE_SLUGS.AGENT && !dateOfJoining) {
    return {
      error: "Date of joining is required when creating an Agent user.",
    };
  }

  const credentials = await buildPasswordCredentials(parsed.data.password);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        password: credentials.password,
        passwordEncrypted: credentials.passwordEncrypted,
        roleId: parsed.data.roleId,
        dateOfJoining,
        isActive: true,
        approvalStatus: "ACTIVE",
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error, "email")) {
      return { error: "A user with this email already exists" };
    }
    throw error;
  }

  revalidateUserRosterPaths();
  invalidateUserCaches(session.user.id);
  return { success: true, email, password: parsed.data.password };
}

export async function updateUser(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.ADMIN_USERS);

  const parsed = updateUserSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password") || undefined,
    roleId: formData.get("roleId"),
    dateOfJoining: formData.get("dateOfJoining") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email, NOT: { id: parsed.data.id } },
  });
  if (existing) {
    return { error: "A user with this email already exists" };
  }

  const roleCheck = await validateRoleAssignment(parsed.data.roleId);
  if ("error" in roleCheck) {
    return { error: roleCheck.error };
  }

  const roleGuard = assertSuperAdminRoleAssignment(
    session,
    roleCheck.role.slug
  );
  if (roleGuard) return roleGuard;

  const dateOfJoining = normalizeJoiningDate(parsed.data.dateOfJoining);
  if (roleCheck.role.slug === SYSTEM_ROLE_SLUGS.AGENT && !dateOfJoining) {
    return {
      error: "Date of joining is required for Agent users.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: parsed.data.id },
    select: { roleId: true },
  });

  const data: {
    name: string;
    email: string;
    roleId: string;
    dateOfJoining: string | null;
    password?: string;
    passwordEncrypted?: string;
    sessionVersion?: { increment: number };
  } = {
    name: parsed.data.name,
    email,
    roleId: parsed.data.roleId,
    dateOfJoining,
  };

  if (parsed.data.password) {
    const credentials = await buildPasswordCredentials(parsed.data.password);
    data.password = credentials.password;
    data.passwordEncrypted = credentials.passwordEncrypted;
    data.sessionVersion = { increment: 1 };
  }

  await prisma.user.update({
    where: { id: parsed.data.id },
    data,
  });

  revalidateUserRosterPaths();
  invalidateUserCaches(session.user.id);
  return {
    success: true,
    email,
    ...(parsed.data.password ? { password: parsed.data.password } : {}),
  };
}

export async function deleteUser(userId: string) {
  const session = await requirePermission(PERMISSIONS.ADMIN_USERS);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const auditCount = await tx.auditSubmission.count({
        where: { submittedById: userId },
      });
      if (auditCount > 0) {
        throw new Error(`USER_HAS_AUDITS:${auditCount}`);
      }

      if (user.role.slug === SUPERADMIN_ROLE_SLUG) {
        const superAdminCount = await tx.user.count({
          where: { role: { slug: SUPERADMIN_ROLE_SLUG } },
        });
        if (superAdminCount <= 1) {
          throw new Error("LAST_SUPERADMIN");
        }
      }

      await tx.user.delete({ where: { id: userId } });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return { error: "User not found" };
      }
      if (error.message === "LAST_SUPERADMIN") {
        return { error: "Cannot delete the last superadmin user" };
      }
      if (error.message.startsWith("USER_HAS_AUDITS:")) {
        const count = error.message.split(":")[1];
        return {
          error: `Cannot delete user — ${count} audit submission(s) on record.`,
        };
      }
    }
    console.error("deleteUser failed:", error);
    return { error: "Could not delete user. Please try again." };
  }

  revalidatePath("/settings");
  invalidateUserCaches(session.user.id, {
    type: "user:deactivated",
    userId,
  });
  return { success: true };
}

export async function bulkDeleteUsers(userIds: string[]) {
  const session = await requirePermission(PERMISSIONS.ADMIN_USERS);

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { error: "No users selected.", deleted: 0, skipped: [] };
  }

  const skipped: { id: string; email: string; reason: string }[] = [];
  let deleted = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: uniqueIds } },
        include: { role: true },
      });

      if (users.length === 0) {
        throw new Error("NO_USERS_FOUND");
      }

      const superAdminCount = await tx.user.count({
        where: { role: { slug: SUPERADMIN_ROLE_SLUG } },
      });
      const superAdminsMarked = users.filter(
        (user) => user.role.slug === SUPERADMIN_ROLE_SLUG
      ).length;

      if (superAdminCount - superAdminsMarked < 1) {
        throw new Error("LAST_SUPERADMIN");
      }

      for (const user of users) {
        const auditCount = await tx.auditSubmission.count({
          where: { submittedById: user.id },
        });
        if (auditCount > 0) {
          skipped.push({
            id: user.id,
            email: user.email,
            reason: `${auditCount} audit(s) on record`,
          });
          continue;
        }
        await tx.user.delete({ where: { id: user.id } });
        deleted += 1;
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NO_USERS_FOUND") {
        return { error: "No matching users found.", deleted: 0, skipped: [] };
      }
      if (error.message === "LAST_SUPERADMIN") {
        return {
          error: "Cannot delete all superadmin users.",
          deleted: 0,
          skipped: uniqueIds.map((id) => ({
            id,
            email: id,
            reason: "Would remove last superadmin",
          })),
        };
      }
    }
    console.error("bulkDeleteUsers failed:", error);
    return {
      error: "Could not delete users. Please try again.",
      deleted,
      skipped,
    };
  }

  if (deleted > 0) {
    revalidatePath("/settings");
    invalidateUserCaches(session.user.id);
  }

  return {
    success: deleted > 0,
    deleted,
    skipped,
  };
}

export async function createRole(formData: FormData) {
  await requirePermission(PERMISSIONS.ADMIN_ROLES);

  const name = String(formData.get("name") ?? "");
  const slugInput = String(formData.get("slug") ?? "");
  const slug = slugInput || slugify(name);

  const parsed = createRoleSchema.safeParse({
    name,
    slug,
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const reservedSlugs = new Set<string>(Object.values(SYSTEM_ROLE_SLUGS));
  if (reservedSlugs.has(parsed.data.slug)) {
    return { error: "This role slug is reserved for a system role." };
  }

  const existing = await prisma.role.findFirst({
    where: {
      OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }],
    },
  });
  if (existing) {
    return { error: "A role with this name or slug already exists" };
  }

  await prisma.role.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/admin/roles");
  invalidateRoleCaches();
  return { success: true };
}

export async function updateRole(formData: FormData) {
  await requirePermission(PERMISSIONS.ADMIN_ROLES);

  const name = String(formData.get("name") ?? "");
  const slugInput = String(formData.get("slug") ?? "");
  const slug = slugInput || slugify(name);

  const parsed = updateRoleSchema.safeParse({
    id: formData.get("id"),
    name,
    slug,
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const role = await prisma.role.findUnique({ where: { id: parsed.data.id } });
  if (!role) {
    return { error: "Role not found" };
  }

  if (role.isSystem && parsed.data.slug !== role.slug) {
    return { error: "System role slug cannot be changed" };
  }

  const existing = await prisma.role.findFirst({
    where: {
      OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }],
      NOT: { id: parsed.data.id },
    },
  });
  if (existing) {
    return { error: "A role with this name or slug already exists" };
  }

  await prisma.role.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      slug: role.isSystem ? role.slug : parsed.data.slug,
      description: parsed.data.description,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/admin/roles");
  invalidateRoleCaches();
  return { success: true };
}

export async function deleteRole(roleId: string) {
  await requirePermission(PERMISSIONS.ADMIN_ROLES);

  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id: roleId },
        include: { _count: { select: { users: true } } },
      });

      if (!role) {
        throw new Error("ROLE_NOT_FOUND");
      }
      if (role.isSystem) {
        throw new Error("SYSTEM_ROLE");
      }
      if (role._count.users > 0) {
        throw new Error("ROLE_HAS_USERS");
      }

      await tx.role.delete({ where: { id: roleId } });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ROLE_NOT_FOUND") return { error: "Role not found" };
      if (error.message === "SYSTEM_ROLE") {
        return { error: "System roles cannot be deleted" };
      }
      if (error.message === "ROLE_HAS_USERS") {
        return { error: "Cannot delete a role that is assigned to users" };
      }
    }
    console.error("deleteRole failed:", error);
    return { error: "Could not delete role. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/admin/roles");
  invalidateRoleCaches();
  return { success: true };
}

export async function bulkDeleteRoles(roleIds: string[]) {
  await requirePermission(PERMISSIONS.ADMIN_ROLES);

  const ids = [...new Set(roleIds.filter(Boolean))];
  if (ids.length === 0) {
    return { error: "No roles selected" };
  }

  const skipped: string[] = [];
  let deleted = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const roles = await tx.role.findMany({
        where: { id: { in: ids } },
        include: { _count: { select: { users: true } } },
      });

      if (roles.length === 0) {
        throw new Error("NO_ROLES_FOUND");
      }

      for (const role of roles) {
        if (role.isSystem) {
          skipped.push(`${role.name} (system role)`);
          continue;
        }
        if (role._count.users > 0) {
          skipped.push(`${role.name} (assigned to users)`);
          continue;
        }
        await tx.role.delete({ where: { id: role.id } });
        deleted += 1;
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ROLES_FOUND") {
      return { error: "No matching roles found" };
    }
    console.error("bulkDeleteRoles failed:", error);
    return { error: "Could not delete roles. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/admin/roles");
  invalidateRoleCaches();

  if (deleted === 0 && skipped.length > 0) {
    return { error: `Could not delete: ${skipped.join(", ")}` };
  }

  return {
    success: deleted > 0,
    deleted,
    skipped: skipped.length > 0 ? skipped : undefined,
  };
}

export async function signOutAction() {
  const { redirect } = await import("next/navigation");
  const { CLEAR_SESSION_PATH } = await import("@/lib/auth-redirects");
  redirect(CLEAR_SESSION_PATH);
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requirePermission(PERMISSIONS.ADMIN_USERS);

  if (userId === session.user.id && !isActive) {
    return { error: "Cannot deactivate your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!target) {
    return { error: "User not found." };
  }

  if (
    !isActive &&
    target.role.slug === SUPERADMIN_ROLE_SLUG &&
    userId === session.user.id
  ) {
    return { error: "Cannot deactivate your own account." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      ...(!isActive ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  await logSecurityAudit({
    action: isActive
      ? SECURITY_AUDIT_ACTIONS.USER_ACTIVATED
      : SECURITY_AUDIT_ACTIONS.USER_DEACTIVATED,
    actorUserId: session.user.id,
    targetUserId: userId,
  });

  revalidateUserRosterPaths();
  revalidatePath("/settings");
  invalidateUserCaches(session.user.id, {
    type: isActive ? "user:activated" : "user:deactivated",
    userId,
  });

  return { success: true as const };
}

export async function revealUserPassword(userId: string) {
  await requirePermission(PERMISSIONS.USER_READ_SENSITIVE);
  const session = await requireAuth();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordEncrypted: true },
  });
  if (!target) {
    return { error: "User not found." };
  }

  let plainPassword: string;
  let wasReset = false;

  if (target.passwordEncrypted) {
    try {
      plainPassword = decryptPassword(target.passwordEncrypted);
    } catch {
      return {
        error:
          "Stored password could not be decrypted. Reset the user's password and try again.",
      };
    }
  } else {
    plainPassword = generateTemporaryPassword();
    wasReset = true;
    const credentials = await buildPasswordCredentials(plainPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: credentials.password,
        passwordEncrypted: credentials.passwordEncrypted,
        sessionVersion: { increment: 1 },
      },
    });
    invalidateUserCaches(session.user.id);
  }

  await logSecurityAudit({
    action: SECURITY_AUDIT_ACTIONS.PASSWORD_READ,
    actorUserId: session.user.id,
    targetUserId: userId,
    metadata: { email: target.email, wasReset },
  });

  return {
    success: true as const,
    email: target.email,
    password: plainPassword,
    wasReset,
  };
}

/** @deprecated Use revealUserPassword */
export async function getUserPasswordHash(userId: string) {
  const result = await revealUserPassword(userId);
  if ("error" in result && result.error) {
    return { error: result.error };
  }
  if (result.success) {
    return {
      success: true as const,
      email: result.email,
      passwordHash: result.password,
    };
  }
  return { error: "Could not reveal password." };
}
