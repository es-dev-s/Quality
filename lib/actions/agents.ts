"use server";
import { agentsTableQuerySchema } from "@/lib/admin/table-query";
import { fetchVisibleAgentUserIds } from "@/lib/audit/agent-assignment-scope";
import { fetchAuditCountsByAgentName } from "@/lib/audit/agent-db";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { pageInfo } from "@/lib/server/page-query";

import { getPendingTransferAgentIdsForSession } from "@/lib/actions/agent-transfer";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { requireAuth } from "@/lib/auth";
import { cacheScopeFromSession } from "@/lib/cache";
import { getCachedAgentsForManagement } from "@/lib/cached-queries/agents";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { invalidateAgentCaches } from "@/lib/invalidate-cache";
import { prisma } from "@/lib/prisma";
import { canManageSettings,canManageUsers,canReadManagedUsers } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)")
  .optional()
  .nullable();

const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Agent name is required").max(120),
  dateOfJoining: isoDateSchema,
  isActive: z.boolean().optional(),
});

const updateAgentSchema = createAgentSchema.extend({
  id: z.string().min(1),
});

function revalidateAgentPaths() {
  revalidatePath("/settings");
  revalidatePath("/forms/audit");
  revalidatePath("/forms");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/dashboard");
  revalidatePath("/audit-transfer-history");
}

function invalidateAgentsAfterMutation() {
  invalidateAgentCaches();
}

export type AgentListItem = {
  id: string;
  name: string;
  email: string;
  profileName: string | null;
  hasProfileName: boolean;
  teamName: string | null;
  dateOfJoining: string | null;
  auditCount: number;
  createdAt: string;
  pendingTransfer?: boolean;
};

export type AgentMutationResult =
  | { ok: true; updated?: number }
  | { ok: false; error: string };

export type BulkAgentDeleteResult = {
  ok: boolean;
  deleted: number;
  skipped: { id: string; name: string; reason: string }[];
  error?: string;
};

async function requireAgentManager() {
  const session = await requireAuth();
  if (!canManageSettings(session.user.role)) {
    return {
      ok: false as const,
      error: "You do not have permission to manage agents.",
    };
  }
  return { ok: true as const, session };
}

export async function getAgentsForManagement(): Promise<{
  agents: AgentListItem[];
  canManage: boolean;
}> {
  const session = await requireAuth();
  const scope = cacheScopeFromSession(session);
  const [result, pendingIds] = await Promise.all([
    getCachedAgentsForManagement(scope)(),
    getPendingTransferAgentIdsForSession().catch(() => [] as string[]),
  ]);
  const pendingSet = new Set(pendingIds);
  return {
    canManage: result.canManage,
    agents: result.agents.map((agent) => ({
      ...agent,
      pendingTransfer: pendingSet.has(agent.id),
    })),
  };
}

export async function createAgent(input: {
  name: string;
  dateOfJoining?: string | null;
  isActive?: boolean;
}): Promise<AgentMutationResult> {
  const access = await requireAgentManager();
  if (!access.ok) return access;

  const parsed = createAgentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid agent data.",
    };
  }

  const { name, nameKey } = normalizeAgentName(parsed.data.name);
  if (!name) {
    return { ok: false, error: "Agent name is required." };
  }

  const existing = await prisma.agent.findUnique({ where: { nameKey } });
  if (existing) {
    return { ok: false, error: "An agent with this name already exists." };
  }

  try {
    await prisma.agent.create({
      data: {
        name,
        nameKey,
        dateOfJoining: parsed.data.dateOfJoining ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    revalidateAgentPaths();
    invalidateAgentsAfterMutation();
    return { ok: true };
  } catch (error) {
    if (isPrismaUniqueViolation(error, "name_key")) {
      return { ok: false, error: "An agent with this name already exists." };
    }
    console.error("createAgent failed:", error);
    return { ok: false, error: "Could not create agent. Please try again." };
  }
}

export async function updateAgent(input: {
  id: string;
  name: string;
  dateOfJoining?: string | null;
  isActive?: boolean;
}): Promise<AgentMutationResult> {
  const access = await requireAgentManager();
  if (!access.ok) return access;

  const parsed = updateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid agent data.",
    };
  }

  const { name, nameKey } = normalizeAgentName(parsed.data.name);
  if (!name) {
    return { ok: false, error: "Agent name is required." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.agent.findUnique({
        where: { id: parsed.data.id },
      });
      if (!existing) {
        throw new Error("AGENT_NOT_FOUND");
      }

      const conflict = await tx.agent.findFirst({
        where: { nameKey, NOT: { id: parsed.data.id } },
      });
      if (conflict) {
        throw new Error("AGENT_NAME_CONFLICT");
      }

      if (name !== existing.name) {
        await tx.auditSubmission.updateMany({
          where: { agent: existing.name },
          data: { agent: name },
        });
      }

      await tx.agent.update({
        where: { id: parsed.data.id },
        data: {
          name,
          nameKey,
          dateOfJoining: parsed.data.dateOfJoining ?? null,
          isActive: parsed.data.isActive ?? existing.isActive,
        },
      });
    });

    revalidateAgentPaths();
    invalidateAgentsAfterMutation();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AGENT_NOT_FOUND") {
        return { ok: false, error: "Agent not found." };
      }
      if (error.message === "AGENT_NAME_CONFLICT") {
        return { ok: false, error: "An agent with this name already exists." };
      }
    }
    if (isPrismaUniqueViolation(error, "name_key")) {
      return { ok: false, error: "An agent with this name already exists." };
    }
    console.error("updateAgent failed:", error);
    return { ok: false, error: "Could not update agent. Please try again." };
  }
}

export async function deleteAgent(id: string): Promise<AgentMutationResult> {
  const access = await requireAgentManager();
  if (!access.ok) return access;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.agent.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("AGENT_NOT_FOUND");
      }

      const auditCount = await tx.auditSubmission.count({
        where: { agent: existing.name },
      });
      if (auditCount > 0) {
        throw new Error(`AGENT_HAS_AUDITS:${auditCount}:${existing.name}`);
      }

      await tx.agent.delete({ where: { id } });
    });

    revalidateAgentPaths();
    invalidateAgentsAfterMutation();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AGENT_NOT_FOUND") {
        return { ok: false, error: "Agent not found." };
      }
      if (error.message.startsWith("AGENT_HAS_AUDITS:")) {
        const [, count, name] = error.message.split(":");
        return {
          ok: false,
          error: `Cannot delete "${name}" — ${count} audit(s) reference this agent. Deactivate instead.`,
        };
      }
    }
    console.error("deleteAgent failed:", error);
    return { ok: false, error: "Could not delete agent. Please try again." };
  }
}

export async function bulkDeleteAgents(
  ids: string[]
): Promise<BulkAgentDeleteResult> {
  const access = await requireAgentManager();
  if (!access.ok) {
    return { ok: false, deleted: 0, skipped: [], error: access.error };
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, deleted: 0, skipped: [], error: "No agents selected." };
  }

  const skipped: BulkAgentDeleteResult["skipped"] = [];
  let deleted = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.agent.findMany({
        where: { id: { in: uniqueIds } },
      });

      if (rows.length === 0) {
        throw new Error("NO_AGENTS_FOUND");
      }

      for (const row of rows) {
        const auditCount = await tx.auditSubmission.count({
          where: { agent: row.name },
        });
        if (auditCount > 0) {
          skipped.push({
            id: row.id,
            name: row.name,
            reason: `${auditCount} audit(s) on record`,
          });
        } else {
          await tx.agent.delete({ where: { id: row.id } });
          deleted += 1;
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_AGENTS_FOUND") {
      return {
        ok: false,
        deleted: 0,
        skipped: [],
        error: "No matching agents found.",
      };
    }
    console.error("bulkDeleteAgents failed:", error);
    return {
      ok: false,
      deleted,
      skipped,
      error: "Could not delete agents. Please try again.",
    };
  }

  if (deleted > 0) {
    revalidateAgentPaths();
    invalidateAgentsAfterMutation();
  }

  return {
    ok: deleted > 0,
    deleted,
    skipped,
    error:
      deleted === 0 && skipped.length > 0
        ? "Selected agents have audits on record and were skipped."
        : undefined,
  };
}

export async function setAgentsActive(
  ids: string[],
  isActive: boolean
): Promise<AgentMutationResult> {
  const access = await requireAgentManager();
  if (!access.ok) return access;

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "No agents selected." };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (!isActive) {
        const remaining = await tx.agent.count({
          where: {
            isActive: true,
            NOT: { id: { in: uniqueIds } },
          },
        });
        if (remaining < 1) {
          throw new Error("LAST_ACTIVE_AGENT");
        }
      }

      const result = await tx.agent.updateMany({
        where: { id: { in: uniqueIds } },
        data: { isActive },
      });
      return result.count;
    });

    revalidateAgentPaths();
    invalidateAgentsAfterMutation();
    return { ok: true, updated };
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ACTIVE_AGENT") {
      return {
        ok: false,
        error: "At least one active agent must remain.",
      };
    }
    console.error("setAgentsActive failed:", error);
    return { ok: false, error: "Could not update agents. Please try again." };
  }
}

export async function getAgentsPage(input: unknown = {}) {
  const session = await requireAuth();
  const query = agentsTableQuerySchema.parse(input);
  const global = canManageSettings(session.user.role) || canManageUsers(session.user.role);
  const allowed = global || canReadManagedUsers(session.user.role);
  const ids = global ? null : allowed ? await fetchVisibleAgentUserIds(session.user.id, session.user.role.slug) : [];
  const scope = { role: { slug: SYSTEM_ROLE_SLUGS.AGENT }, ...(ids ? { id: { in: ids } } : {}) };
  const contains = { contains: query.search, mode: "insensitive" as const };
  const where = query.search ? { AND: [scope, { OR: [{ name: contains }, { email: contains }, { teamName: contains }] }] } : scope;
  const [totalCount, total, counts, pendingIds] = await Promise.all([
    prisma.user.count({ where: scope }), prisma.user.count({ where }), fetchAuditCountsByAgentName(), getPendingTransferAgentIdsForSession().catch(() => [] as string[]),
  ]);
  const pagination = pageInfo(total, query);
  const rows = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, teamName: true, dateOfJoining: true, createdAt: true }, orderBy: [{ name: "asc" }, { email: "asc" }, { id: "asc" }], skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize });
  const pending = new Set(pendingIds);
  const agents: AgentListItem[] = rows.map((row) => {
    const profileName = row.name?.trim() || null;
    const name = profileName || row.email;
    return { ...row, name, profileName, hasProfileName: Boolean(profileName), createdAt: row.createdAt.toISOString(), auditCount: counts.get(name) ?? 0, pendingTransfer: pending.has(row.id) };
  });
  return { agents, pagination, totalCount, canManage: canManageSettings(session.user.role) };
}
