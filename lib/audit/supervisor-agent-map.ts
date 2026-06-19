import type { Prisma } from "@prisma/client";
import { fetchSupervisorTierVisibleAgentNames } from "@/lib/audit/agent-assignment-scope";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type SessionLike = Parameters<typeof scopedAuditWhere>[0];

function sortUnique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Agents linked to each supervisor (provisioning + audit history), scoped to visible rosters. */
export async function buildSupervisorAgentMap(
  session: SessionLike,
  supervisors: string[],
  visibleAgents: string[]
): Promise<Record<string, string[]>> {
  const visibleSet = new Set(visibleAgents);
  const map: Record<string, string[]> = {};
  for (const name of supervisors) {
    map[name] = [];
  }

  const supervisorUsers = await prisma.user.findMany({
    where: {
      role: { slug: SYSTEM_ROLE_SLUGS.SUPERVISOR },
      isActive: true,
      approvalStatus: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });

  const idByDisplayName = new Map<string, string>();
  for (const user of supervisorUsers) {
    idByDisplayName.set(resolveRoleUserName(user), user.id);
  }

  await Promise.all(
    supervisors.map(async (supervisorName) => {
      const userId = idByDisplayName.get(supervisorName);
      if (!userId) return;
      const linked = await fetchSupervisorTierVisibleAgentNames(userId);
      map[supervisorName] = sortUnique(
        linked.filter((agent) => visibleSet.has(agent))
      );
    })
  );

  const where: Prisma.AuditSubmissionWhereInput = await scopedAuditWhere(session);
  const pairs = await prisma.auditSubmission.findMany({
    where,
    select: { agent: true, supervisor: true },
    distinct: ["agent", "supervisor"],
  });

  for (const row of pairs) {
    const supervisor = row.supervisor?.trim();
    const agent = row.agent?.trim();
    if (!supervisor || !agent || !visibleSet.has(agent)) continue;
    if (!map[supervisor]) {
      map[supervisor] = [];
    }
    if (!map[supervisor].includes(agent)) {
      map[supervisor].push(agent);
    }
  }

  for (const name of supervisors) {
    map[name] = sortUnique(map[name] ?? []);
  }

  return map;
}
