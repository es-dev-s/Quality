import { normalizeAgentName } from "@/lib/audit/agent-name";
import { fetchUserAuditMatchNames } from "@/lib/audit/user-audit-match";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Display names for deactivated users that appear as agents on the given records.
 * Used only by dashboard "Audit target — per agent".
 */
export async function fetchDeactivatedAgentMatchNames(
  recordAgentNames: string[]
): Promise<string[]> {
  const recordKeys = new Set(
    recordAgentNames
      .map((name) => normalizeAgentName(name).nameKey)
      .filter(Boolean)
  );
  if (recordKeys.size === 0) return [];

  const inactiveUsers = await prisma.user.findMany({
    where: {
      isActive: false,
      role: { slug: SYSTEM_ROLE_SLUGS.AGENT },
    },
    select: { id: true, name: true, email: true },
  });
  if (inactiveUsers.length === 0) return [];

  const rosterRows = await prisma.agent.findMany({
    where: { nameKey: { in: [...recordKeys] } },
    select: { name: true, nameKey: true },
  });
  const rosterKeys = new Set(rosterRows.map((row) => row.nameKey));

  const matchedUsers = inactiveUsers.filter((user) => {
    const nameKey = user.name ? normalizeAgentName(user.name).nameKey : "";
    const emailKey = user.email ? normalizeAgentName(user.email).nameKey : "";
    return (
      (nameKey !== "" && recordKeys.has(nameKey)) ||
      (emailKey !== "" && recordKeys.has(emailKey)) ||
      (nameKey !== "" && rosterKeys.has(nameKey))
    );
  });
  if (matchedUsers.length === 0) return [];

  const names = new Set<string>();
  const aliasKeys = new Set<string>();

  for (const user of matchedUsers) {
    for (const name of await fetchUserAuditMatchNames(user)) {
      names.add(name);
    }
    if (user.name) {
      aliasKeys.add(normalizeAgentName(user.name).nameKey);
    }
  }

  if (aliasKeys.size > 0) {
    const aliases = await prisma.agent.findMany({
      where: { nameKey: { in: [...aliasKeys] } },
      select: { name: true },
    });
    for (const row of aliases) {
      if (row.name) names.add(row.name);
    }
  }

  return [...names];
}
