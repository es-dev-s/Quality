import { resolveRoleUserName } from "@/lib/audit/role-users";
import { prisma } from "@/lib/prisma";

function personKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Current team name keyed by user display name and email (case-insensitive). */
export async function fetchPersonTeamNameMap(): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    select: { name: true, email: true, teamName: true },
  });

  const map = new Map<string, string>();
  for (const user of users) {
    const team = user.teamName?.trim();
    if (!team) continue;

    const keys = new Set(
      [resolveRoleUserName(user), user.email, user.name ?? ""]
        .map((value) => personKey(value))
        .filter(Boolean)
    );
    for (const key of keys) {
      map.set(key, team);
    }
  }

  return map;
}

/**
 * Team label for analytics: frozen snapshot first, then live User.teamName
 * of the supervisor, else the agent. Never falls back to a person's name.
 */
export function resolveRecordTeamName(
  record: {
    agent: string;
    supervisor: string | null;
    teamNameSnapshot?: string | null;
  },
  teamByPerson: Map<string, string>
): string {
  const snapshot = record.teamNameSnapshot?.trim();
  if (snapshot) return snapshot;

  const supervisor = record.supervisor?.trim();
  if (supervisor) {
    const team = teamByPerson.get(personKey(supervisor));
    if (team) return team;
  }

  const agent = record.agent?.trim();
  if (agent) {
    const team = teamByPerson.get(personKey(agent));
    if (team) return team;
  }

  return "Unassigned";
}

export async function resolveTeamNameSnapshot(
  agent: string,
  supervisor: string | null
): Promise<string | null> {
  const teamByPerson = await fetchPersonTeamNameMap();
  const label = resolveRecordTeamName({ agent, supervisor }, teamByPerson);
  return label === "Unassigned" ? null : label;
}
