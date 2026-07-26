import { normalizeAgentName } from "@/lib/audit/agent-name";
import {
  fetchAgentRoleUsers,
  fetchUsersByRoleSlugs,
  type RoleUserRecord,
} from "@/lib/audit/role-users";
import { SUPERVISOR_TIER_ROLE_SLUG_FILTER } from "@/lib/audit/supervisor-tier";
import type {
  ImportEntityCatalog,
  ImportEntityRef,
} from "@/lib/import/import-entity-catalog";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { withActiveUserFilter } from "@/lib/user-active-filter";
import { prisma } from "@/lib/prisma";

function nameKey(value: string): string {
  return normalizeAgentName(value).nameKey;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * Index a role user under display name, profile name, and email so sheet values
 * match any of those forms. First key wins for canonical `name`.
 */
function pushUserAliases(
  target: ImportEntityRef[],
  seenKeys: Set<string>,
  user: RoleUserRecord
): void {
  const displayName = user.name.trim();
  if (!displayName) return;

  const aliasKeys = [
    nameKey(displayName),
    user.profileName ? nameKey(user.profileName) : "",
    nameKey(user.email),
  ].filter(Boolean);

  for (const key of aliasKeys) {
    if (seenKeys.has(key)) continue;
    target.push({
      id: user.id,
      name: displayName,
      nameKey: key,
    });
    seenKeys.add(key);
  }
}

/** Load active Agent / auditor / Team directories for import checks. */
export async function loadImportEntityCatalog(): Promise<ImportEntityCatalog> {
  const [agentUsers, rosterAgents, auditorUsers, supervisorUsers] =
    await Promise.all([
      fetchAgentRoleUsers(),
      prisma.agent.findMany({
        where: { isActive: true },
        select: { id: true, name: true, nameKey: true },
        orderBy: { name: "asc" },
      }),
      // Anyone who can submit audits may appear as Quality Auditor on sheets.
      fetchUsersByRoleSlugs([
        SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
        SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
        SYSTEM_ROLE_SLUGS.SUPERVISOR,
        SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR,
        SYSTEM_ROLE_SLUGS.ADMIN,
        SYSTEM_ROLE_SLUGS.SUPERADMIN,
      ]),
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

  // Prefer agent-role users, then fill gaps from the agents roster table.
  // Live DB has many roster names without a matching agent User account.
  const agents: ImportEntityRef[] = [];
  const agentKeys = new Set<string>();
  for (const user of agentUsers) {
    pushUserAliases(agents, agentKeys, user);
  }
  for (const row of rosterAgents) {
    const key = row.nameKey || nameKey(row.name);
    if (!key || agentKeys.has(key)) continue;
    agents.push({
      id: row.id,
      name: row.name,
      nameKey: key,
    });
    agentKeys.add(key);
  }

  const auditors: ImportEntityRef[] = [];
  const auditorKeys = new Set<string>();
  for (const user of auditorUsers) {
    pushUserAliases(auditors, auditorKeys, user);
  }

  return {
    agents,
    auditors,
    teams,
    supervisorNameToTeam,
  };
}
