import { cache } from "react";
import type { Agent as PrismaAgent } from "@prisma/client";
import { normalizeAgentName } from "@/lib/audit/agent-name";
import { fetchActiveAgentUserNames } from "@/lib/audit/agent-users";
import { prisma } from "@/lib/prisma";
import { AGENTS } from "@/lib/audit/seed-data";
import {
  isAgentsInitialized,
  markAgentsInitialized,
} from "@/lib/db/system-meta";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export type AgentRow = {
  id: string;
  name: string;
  dateOfJoining: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function mapAgentRow(row: PrismaAgent): AgentRow {
  return {
    id: row.id,
    name: row.name,
    dateOfJoining: row.dateOfJoining,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function legacyAgentNamesFromConfig(): Promise<string[]> {
  const row = await prisma.interactionConfig.findUnique({
    where: { id: "default" },
  });
  if (!row?.config || typeof row.config !== "object" || Array.isArray(row.config)) {
    return [];
  }
  return parseStringArray((row.config as Record<string, unknown>).agents);
}

/** Seeds agents once on first deploy — never re-seeds after intentional deletion. */
export const ensureDefaultAgents = cache(async (): Promise<void> => {
  if (await isAgentsInitialized()) return;

  const legacyNames = await legacyAgentNamesFromConfig();
  const seedNames = legacyNames.length > 0 ? legacyNames : [...AGENTS];

  if (seedNames.length > 0) {
    await prisma.agent.createMany({
      data: seedNames.map((rawName) => {
        const { name, nameKey } = normalizeAgentName(rawName);
        return { name, nameKey, isActive: true };
      }),
      skipDuplicates: true,
    });
  }

  await markAgentsInitialized();
});

export async function fetchActiveAgentNames(): Promise<string[]> {
  return fetchActiveAgentUserNames();
}

export async function fetchAllAgents(): Promise<AgentRow[]> {
  await ensureDefaultAgents();
  const rows = await prisma.agent.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map(mapAgentRow);
}

export async function fetchAuditCountsByAgentName(): Promise<Map<string, number>> {
  const groups = await prisma.auditSubmission.groupBy({
    by: ["agent"],
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.agent, group._count._all]));
}

export async function countAuditsForAgentName(name: string): Promise<number> {
  return prisma.auditSubmission.count({
    where: { agent: name },
  });
}
