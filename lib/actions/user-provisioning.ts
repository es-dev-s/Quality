"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-guards";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  assertActorManagesUser,
  buildManagedUsersWhere,
  fetchQmScopedAgentUserIds,
} from "@/lib/user-roster-scope";
import {
  invalidateAgentCaches,
  invalidateUserCaches,
} from "@/lib/invalidate-cache";
import { buildPasswordCredentials } from "@/lib/password-credentials";
import {
  canApproveAgentRequests,
  canApproveAnalystRequests,
  canAssignAgents,
  canManageManagedUsers,
  canProvisionAgents,
  canProvisionAnalysts,
  canReadManagedUsers,
  hasScope,
  isSuperAdmin,
} from "@/lib/rbac";

const isoDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)"),
  z.literal(""),
]);

const requestUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  dateOfJoining: isoDateSchema.optional(),
});

const reviewSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export type ProvisioningRequestRow = {
  id: string;
  name: string;
  email: string;
  targetRoleSlug: string;
  targetRoleLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  dateOfJoining: string | null;
  requestedByName: string;
  requestedByEmail: string;
  reviewedByName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleSlug: string;
  dateOfJoining: string | null;
  auditCount: number;
  createdAt: string;
};

export type AssignableAgentRow = {
  id: string;
  name: string;
  email: string;
};

export type AssigneeOptionRow = {
  id: string;
  name: string;
  email: string;
  roleSlug: string;
  roleName: string;
};

export type AgentAssignmentRow = {
  id: string;
  agentId: string;
  agentName: string;
  assignToId: string;
  assignToName: string;
};

function normalizeJoiningDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function revalidateProvisioningPaths(actorId?: string) {
  revalidatePath("/settings");
  revalidatePath("/forms/audit");
  revalidatePath("/forms");
  revalidatePath("/audit-logs");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  if (actorId) {
    invalidateUserCaches(actorId);
    invalidateAgentCaches();
  }
}

function mapRequest(row: {
  id: string;
  name: string;
  email: string;
  targetRoleSlug: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  dateOfJoining: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  requestedBy: { name: string | null; email: string };
  reviewedBy: { name: string | null; email: string } | null;
}): ProvisioningRequestRow {
  const roleLabel =
    row.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT
      ? "Agent"
      : row.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
        ? "Quality Analyst"
        : row.targetRoleSlug;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    targetRoleSlug: row.targetRoleSlug,
    targetRoleLabel: roleLabel,
    status: row.status,
    dateOfJoining: row.dateOfJoining,
    requestedByName: resolveRoleUserName(row.requestedBy),
    requestedByEmail: row.requestedBy.email,
    reviewedByName: row.reviewedBy
      ? resolveRoleUserName(row.reviewedBy)
      : null,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

async function assertEmailAvailableForNewRequest(email: string) {
  const normalized = email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existingUser) {
    return "A user with this email already exists.";
  }

  const pending = await prisma.userProvisioningRequest.findFirst({
    where: { email: normalized, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return "A pending approval request already exists for this email.";
  }

  return null;
}

async function assertEmailAvailableForApproval(email: string, requestId: string) {
  const normalized = email.toLowerCase();
  const request = await prisma.userProvisioningRequest.findUnique({
    where: { id: requestId },
    select: { createdUserId: true, status: true },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });

  if (!existingUser) {
    return null;
  }

  if (
    request?.status === "APPROVED" &&
    request.createdUserId === existingUser.id
  ) {
    return null;
  }

  return "An account with this email already exists. If it was created manually in Users, reject this request or remove the duplicate account first.";
}

async function getRoleIdBySlug(slug: string) {
  const role = await prisma.role.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!role) {
    throw new Error(`Role not found: ${slug}`);
  }
  return role.id;
}

export async function getTeamManagementData() {
  const session = await requireAuth();
  const role = session.user.role;

  const isSuperAdminRole = isSuperAdmin(role);
  const canProvisionAgent = canProvisionAgents(role);
  const canProvisionAnalyst = canProvisionAnalysts(role);
  const canApproveAgent =
    canApproveAgentRequests(role) &&
    (role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER || isSuperAdminRole);
  const canApproveAnalyst =
    canApproveAnalystRequests(role) &&
    (role.slug === SYSTEM_ROLE_SLUGS.ADMIN || isSuperAdminRole);
  const canReadManaged = canReadManagedUsers(role);
  const canManageManaged = canManageManagedUsers(role);
  const canAssign = canAssignAgents(role);

  if (
    !canProvisionAgent &&
    !canProvisionAnalyst &&
    !canApproveAgent &&
    !canApproveAnalyst &&
    !canReadManaged &&
    !canAssign &&
    !hasScope(role, PERMISSIONS.ADMIN_USERS)
  ) {
    return {
      canProvisionAgent: false,
      canProvisionAnalyst: false,
      canApproveAgent: false,
      canApproveAnalyst: false,
      canReadManaged: false,
      canManageManaged: false,
      canAssignAgents: false,
      myRequests: [] as ProvisioningRequestRow[],
      pendingApprovals: [] as ProvisioningRequestRow[],
      managedUsers: [] as ManagedUserRow[],
      assignableAgents: [] as AssignableAgentRow[],
      assigneeOptions: [] as AssigneeOptionRow[],
      agentAssignments: [] as AgentAssignmentRow[],
    };
  }

  const requestInclude = {
    requestedBy: { select: { name: true, email: true } },
    reviewedBy: { select: { name: true, email: true } },
  } as const;

  const pendingAgentFilter = canApproveAgent
    ? isSuperAdminRole
      ? {
          status: "PENDING" as const,
          targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
        }
      : {
          status: "PENDING" as const,
          targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
          requestedBy: {
            role: {
              slug: {
                in: [
                  SYSTEM_ROLE_SLUGS.SUPERVISOR,
                  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
                ],
              },
            },
          },
        }
    : null;

  const managedUsersWhere = canReadManaged
    ? await buildManagedUsersWhere(session.user.id, role)
    : null;

  const [
    myRequests,
    pendingApprovals,
    managedUsers,
    assignableAgents,
    assigneeOptions,
    agentAssignments,
  ] = await Promise.all([
    prisma.userProvisioningRequest.findMany({
      where: { requestedById: session.user.id },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    canApproveAgent || canApproveAnalyst
      ? prisma.userProvisioningRequest.findMany({
          where: {
            status: "PENDING",
            OR: [
              ...(pendingAgentFilter ? [pendingAgentFilter] : []),
              ...(canApproveAnalyst
                ? [{ targetRoleSlug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST }]
                : []),
            ],
          },
          include: requestInclude,
          orderBy: { createdAt: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
    managedUsersWhere
      ? prisma.user.findMany({
          where: managedUsersWhere,
          include: { role: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canAssign
      ? isSuperAdminRole
        ? prisma.user.findMany({
            where: {
              role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
              isActive: true,
              approvalStatus: "ACTIVE",
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
          })
        : prisma.user.findMany({
            where: {
              id: { in: await fetchQmScopedAgentUserIds(session.user.id) },
              role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
              isActive: true,
              approvalStatus: "ACTIVE",
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
          })
      : Promise.resolve([]),
    canAssign
      ? prisma.user.findMany({
          where: {
            role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST },
            isActive: true,
            approvalStatus: "ACTIVE",
          },
          include: { role: { select: { slug: true, name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canAssign
      ? isSuperAdminRole
        ? prisma.agentAssignment.findMany({
            where: {
              assignedTo: { role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST } },
            },
            include: {
              agent: { select: { id: true, name: true, email: true } },
              assignedTo: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { assignedAt: "desc" },
          })
        : prisma.agentAssignment.findMany({
            where: {
              assignedById: session.user.id,
              assignedTo: { role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST } },
            },
            include: {
              agent: { select: { id: true, name: true, email: true } },
              assignedTo: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { assignedAt: "desc" },
          })
      : Promise.resolve([]),
  ]);

  let managedWithCounts: ManagedUserRow[] = [];
  if (managedUsers.length > 0) {
    const agentNames = managedUsers
      .filter((user) => user.role.slug === SYSTEM_ROLE_SLUGS.AGENT)
      .map((user) => resolveRoleUserName(user));
    const analystNames = managedUsers
      .filter((user) => user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST)
      .map((user) => resolveRoleUserName(user));

    const [agentCounts, analystCounts] = await Promise.all([
      agentNames.length > 0
        ? prisma.auditSubmission.groupBy({
            by: ["agent"],
            where: { agent: { in: agentNames } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      analystNames.length > 0
        ? prisma.auditSubmission.groupBy({
            by: ["auditor"],
            where: { auditor: { in: analystNames } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const countByAgent = new Map(
      agentCounts.map((row) => [row.agent, row._count._all])
    );
    const countByAnalyst = new Map(
      analystCounts.map((row) => [row.auditor ?? "", row._count._all])
    );

    managedWithCounts = managedUsers.map((user) => {
      const displayName = resolveRoleUserName(user);
      const auditCount =
        user.role.slug === SYSTEM_ROLE_SLUGS.AGENT
          ? countByAgent.get(displayName) ?? 0
          : user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
            ? countByAnalyst.get(displayName) ?? 0
            : 0;

      return {
        id: user.id,
        name: displayName,
        email: user.email,
        roleName: user.role.name,
        roleSlug: user.role.slug,
        dateOfJoining: user.dateOfJoining,
        auditCount,
        createdAt: user.createdAt.toISOString(),
      };
    });
  }

  return {
    canProvisionAgent,
    canProvisionAnalyst,
    canApproveAgent,
    canApproveAnalyst,
    canReadManaged,
    canManageManaged,
    canAssignAgents: canAssign,
    myRequests: myRequests.map(mapRequest),
    pendingApprovals: pendingApprovals.map(mapRequest),
    managedUsers: managedWithCounts,
    assignableAgents: assignableAgents.map((user) => ({
      id: user.id,
      name: resolveRoleUserName(user),
      email: user.email,
    })),
    assigneeOptions: assigneeOptions.map((user) => ({
      id: user.id,
      name: resolveRoleUserName(user),
      email: user.email,
      roleSlug: user.role.slug,
      roleName: user.role.name,
    })),
    agentAssignments: agentAssignments.map((row) => ({
      id: row.id,
      agentId: row.agent.id,
      agentName: resolveRoleUserName(row.agent),
      assignToId: row.assignedTo.id,
      assignToName: resolveRoleUserName(row.assignedTo),
    })),
  };
}

export async function requestAgentUser(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_PROVISION_AGENT);
  const session = await requireAuth();

  const parsed = requestUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    dateOfJoining: formData.get("dateOfJoining") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const dateOfJoining = normalizeJoiningDate(parsed.data.dateOfJoining);
  if (!dateOfJoining) {
    return { error: "Date of joining is required for agent requests." };
  }

  const email = parsed.data.email.toLowerCase();
  const emailError = await assertEmailAvailableForNewRequest(email);
  if (emailError) {
    return { error: emailError };
  }

  const credentials = await buildPasswordCredentials(parsed.data.password);

  try {
    await prisma.userProvisioningRequest.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash: credentials.password,
        passwordEncrypted: credentials.passwordEncrypted,
        dateOfJoining,
        targetRoleSlug: SYSTEM_ROLE_SLUGS.AGENT,
        requestedById: session.user.id,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { error: "A pending request already exists for this email." };
    }
    throw error;
  }

  revalidateProvisioningPaths(session.user.id);
  return {
    success: true,
    message: "Agent request submitted for Quality Manager approval.",
  };
}

export async function requestQualityAnalystUser(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_PROVISION_ANALYST);
  const session = await requireAuth();

  const parsed = requestUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    dateOfJoining: formData.get("dateOfJoining") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const emailError = await assertEmailAvailableForNewRequest(email);
  if (emailError) {
    return { error: emailError };
  }

  const credentials = await buildPasswordCredentials(parsed.data.password);

  try {
    await prisma.userProvisioningRequest.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash: credentials.password,
        passwordEncrypted: credentials.passwordEncrypted,
        dateOfJoining: normalizeJoiningDate(parsed.data.dateOfJoining),
        targetRoleSlug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
        requestedById: session.user.id,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return { error: "A pending request already exists for this email." };
    }
    throw error;
  }

  revalidateProvisioningPaths(session.user.id);
  return {
    success: true,
    message: "Quality Analyst request submitted for Admin approval.",
  };
}

async function approveRequest(requestId: string, reviewerId: string, note?: string) {
  const request = await prisma.userProvisioningRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    return { error: "Request not found." };
  }

  if (request.status === "APPROVED" && request.createdUserId) {
    return { success: true, message: "This request was already approved." };
  }

  if (request.status !== "PENDING") {
    return { error: "Request not found or already reviewed." };
  }

  if (!request.passwordHash) {
    return {
      error: "This request no longer has credentials attached. Reject it and ask the requester to submit again.",
    };
  }

  const emailError = await assertEmailAvailableForApproval(
    request.email,
    requestId
  );
  if (emailError) {
    return { error: emailError };
  }

  const roleId = await getRoleIdBySlug(request.targetRoleSlug);

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.userProvisioningRequest.findUnique({
        where: { id: requestId },
      });
      if (!fresh || fresh.status !== "PENDING") {
        throw new Error("REQUEST_ALREADY_REVIEWED");
      }
      if (!fresh.passwordHash) {
        throw new Error("REQUEST_MISSING_PASSWORD");
      }

      const user = await tx.user.create({
        data: {
          name: fresh.name,
          email: fresh.email,
          password: fresh.passwordHash,
          passwordEncrypted: fresh.passwordEncrypted,
          roleId,
          dateOfJoining: fresh.dateOfJoining,
          createdById: fresh.requestedById,
          isActive: true,
          approvalStatus: "ACTIVE",
        },
      });

      await tx.userProvisioningRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewNote: note?.trim() || null,
          reviewedAt: new Date(),
          createdUserId: user.id,
          passwordHash: "",
          passwordEncrypted: "",
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_ALREADY_REVIEWED") {
      return { error: "This request was already reviewed." };
    }
    if (error instanceof Error && error.message === "REQUEST_MISSING_PASSWORD") {
      return {
        error: "This request no longer has credentials attached. Reject it and ask the requester to submit again.",
      };
    }
    if (isPrismaUniqueViolation(error, "email")) {
      return {
        error:
          "An account with this email already exists. Reject this request or remove the duplicate account first.",
      };
    }
    throw error;
  }

  revalidateProvisioningPaths(reviewerId);
  return { success: true, message: "User approved and account created." };
}

export async function approveAgentRequest(formData: FormData) {
  const session = await requireAuth();
  if (
    session.user.role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
    !isSuperAdmin(session.user.role)
  ) {
    return {
      error: "Agent requests must be approved by a Quality Manager or Super Admin in Team management.",
    };
  }
  await requirePermission(PERMISSIONS.USERS_APPROVE_AGENT);

  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const request = await prisma.userProvisioningRequest.findUnique({
    where: { id: parsed.data.id },
    select: { targetRoleSlug: true, status: true },
  });
  if (
    !request ||
    request.status !== "PENDING" ||
    request.targetRoleSlug !== SYSTEM_ROLE_SLUGS.AGENT
  ) {
    return { error: "Invalid agent approval request." };
  }

  return approveRequest(parsed.data.id, session.user.id, parsed.data.note);
}

export async function approveAnalystRequest(formData: FormData) {
  const session = await requireAuth();
  const roleSlug = session.user.role.slug;
  if (
    roleSlug !== SYSTEM_ROLE_SLUGS.ADMIN &&
    !isSuperAdmin(session.user.role)
  ) {
    return {
      error:
        "Quality Analyst requests must be approved by Admin or Super Admin in Team management.",
    };
  }
  if (!canApproveAnalystRequests(session.user.role)) {
    return { error: "You do not have permission to approve analyst requests." };
  }

  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const request = await prisma.userProvisioningRequest.findUnique({
    where: { id: parsed.data.id },
    select: { targetRoleSlug: true, status: true },
  });
  if (
    !request ||
    request.status !== "PENDING" ||
    request.targetRoleSlug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    return { error: "Invalid analyst approval request." };
  }

  return approveRequest(parsed.data.id, session.user.id, parsed.data.note);
}

export async function rejectProvisioningRequest(formData: FormData) {
  const session = await requireAuth();

  const parsed = reviewSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const request = await prisma.userProvisioningRequest.findUnique({
    where: { id: parsed.data.id },
    select: { targetRoleSlug: true, status: true },
  });

  if (!request || request.status !== "PENDING") {
    return { error: "Request not found or already reviewed." };
  }

  const canReject =
    (request.targetRoleSlug === SYSTEM_ROLE_SLUGS.AGENT &&
      ((session.user.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER &&
        canApproveAgentRequests(session.user.role)) ||
        isSuperAdmin(session.user.role))) ||
    (request.targetRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST &&
      (session.user.role.slug === SYSTEM_ROLE_SLUGS.ADMIN ||
        isSuperAdmin(session.user.role)) &&
      canApproveAnalystRequests(session.user.role));

  if (!canReject) {
    return { error: "You do not have permission to reject this request." };
  }

  await prisma.userProvisioningRequest.update({
    where: { id: parsed.data.id },
    data: {
      status: "REJECTED",
      reviewedById: session.user.id,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedAt: new Date(),
      passwordHash: "",
    },
  });

  revalidateProvisioningPaths(session.user.id);
  return { success: true, message: "Request rejected." };
}

export async function resetManagedUserPassword(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE_MANAGED);
  const session = await requireAuth();

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const manageError = await assertActorManagesUser(
    session.user.id,
    session.user.role,
    parsed.data.userId
  );
  if (manageError) {
    return { error: manageError };
  }

  const managed = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true },
  });

  if (!managed) {
    return { error: "User not found." };
  }

  const credentials = await buildPasswordCredentials(parsed.data.password);
  await prisma.user.update({
    where: { id: managed.id },
    data: {
      password: credentials.password,
      passwordEncrypted: credentials.passwordEncrypted,
      sessionVersion: { increment: 1 },
    },
  });

  revalidateProvisioningPaths(session.user.id);
  return { success: true, message: `Password updated for ${managed.email}.` };
}
