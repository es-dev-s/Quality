import type { Prisma } from "@prisma/client";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

export type AuditOwnership = {
  agentUserId: string | null;
  ownerSupervisorId: string | null;
  teamMembershipId: string | null;
};

const EMPTY_OWNERSHIP: AuditOwnership = {
  agentUserId: null,
  ownerSupervisorId: null,
  teamMembershipId: null,
};

type OwnershipDb = Pick<Prisma.TransactionClient, "user" | "agentTeamMembership">;

type AgentCandidate = {
  id: string;
  createdById: string | null;
};

function keysFor(user: { name: string | null; email: string }): string[] {
  const keys = new Set<string>();
  const name = user.name?.trim();
  if (name) keys.add(normalizeAgentName(name).nameKey);
  const email = user.email?.trim().toLowerCase();
  if (email) keys.add(email);
  return [...keys];
}

/**
 * Resolves the agent user + owning supervisor for audits by agent display name.
 * Loads the agent roster once, so it is cheap to reuse across a bulk import.
 * Ambiguous names (two agent users share it) and unknown names resolve to null
 * — ownership is never guessed.
 */
export async function createAuditOwnershipResolver(db: OwnershipDb) {
  const agents = await db.user.findMany({
    where: { role: { slug: SYSTEM_ROLE_SLUGS.AGENT } },
    select: { id: true, name: true, email: true, createdById: true },
  });

  const byKey = new Map<string, AgentCandidate[]>();
  for (const agent of agents) {
    for (const key of keysFor(agent)) {
      const list = byKey.get(key) ?? [];
      if (!list.some((row) => row.id === agent.id)) {
        list.push({ id: agent.id, createdById: agent.createdById });
      }
      byKey.set(key, list);
    }
  }

  const agentIds = agents.map((agent) => agent.id);
  const openMemberships =
    agentIds.length === 0
      ? []
      : await db.agentTeamMembership.findMany({
          where: { agentUserId: { in: agentIds }, endedAt: null },
          select: { id: true, agentUserId: true, supervisorId: true },
        });
  const membershipByAgent = new Map(
    openMemberships.map((row) => [row.agentUserId, row])
  );

  return function resolve(agentName: string | null | undefined): AuditOwnership {
    const trimmed = agentName?.trim();
    if (!trimmed) return EMPTY_OWNERSHIP;
    const candidates = byKey.get(normalizeAgentName(trimmed).nameKey) ?? [];
    if (candidates.length !== 1) return EMPTY_OWNERSHIP;
    const agent = candidates[0];
    const membership = membershipByAgent.get(agent.id);
    return {
      agentUserId: agent.id,
      ownerSupervisorId: agent.createdById,
      teamMembershipId:
        membership && membership.supervisorId === agent.createdById
          ? membership.id
          : null,
    };
  };
}

/** Single-audit convenience wrapper; never throws (ownership is best-effort). */
export async function resolveAuditOwnership(
  db: OwnershipDb,
  agentName: string | null | undefined
): Promise<AuditOwnership> {
  try {
    const resolve = await createAuditOwnershipResolver(db);
    return resolve(agentName);
  } catch (error) {
    console.error("Audit ownership resolution failed:", error);
    return EMPTY_OWNERSHIP;
  }
}
