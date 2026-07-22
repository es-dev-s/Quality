import { normalizeAgentName } from "@/lib/audit/agent-name";
import {
  fetchAgentRoleUsers,
  fetchQualityAnalystRoleUsers,
} from "@/lib/audit/role-users";
import { SUPERVISOR_TIER_ROLE_SLUG_FILTER } from "@/lib/audit/supervisor-tier";
import { withActiveUserFilter } from "@/lib/user-active-filter";
import { prisma } from "@/lib/prisma";
import type { ImportEntityCatalog } from "@/lib/import/import-entity-catalog";

function nameKey(value: string): string {
  return normalizeAgentName(value).nameKey;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Load active Agent / Quality Analyst / Team directories for import checks. */
export async function loadImportEntityCatalog(): Promise<ImportEntityCatalog> {
  const [agents, auditors, supervisorUsers] = await Promise.all([
    fetchAgentRoleUsers(),
    fetchQualityAnalystRoleUsers(),
    prisma.user.findMany({
      where: withActiveUserFilter({
        role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER },
      }),
      select: { id: true, name: true, email: true, teamName: true },
    }),
  ]);

  const teams = uniqueSorted(
    supervisorUsers
      .map((user) => user.teamName?.trim() ?? "")
      .filter(Boolean)
  );

  const supervisorNameToTeam: Record<string, string> = {};
  for (const user of supervisorUsers) {
    const profileName = (user.name?.trim() || user.email).trim();
    const team = user.teamName?.trim() || profileName;
    if (profileName) {
      supervisorNameToTeam[nameKey(profileName)] = team;
    }
  }

  return {
    agents: agents.map((user) => ({
      id: user.id,
      name: user.name,
      nameKey: nameKey(user.name),
    })),
    auditors: auditors.map((user) => ({
      id: user.id,
      name: user.name,
      nameKey: nameKey(user.name),
    })),
    teams,
    supervisorNameToTeam,
  };
}
