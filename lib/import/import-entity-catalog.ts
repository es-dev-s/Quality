import { normalizeAgentName } from "@/lib/audit/agent-name";

/** Client-safe types + matchers for audit import entity checks (no Prisma). */

export type ImportEntityRef = {
  id: string;
  name: string;
  nameKey: string;
};

export type ImportEntityCatalog = {
  agents: ImportEntityRef[];
  auditors: ImportEntityRef[];
  /** Canonical team names from active supervisor users. */
  teams: string[];
  /** Supervisor profile name → canonical team name (falls back to profile name). */
  supervisorNameToTeam: Record<string, string>;
};

export type ResolvedImportEntities = {
  agentName: string;
  auditorName: string;
  /** Optional sheet team label — not validated against DB. */
  teamName: string;
};

export type ImportEntityValidation =
  | {
      ok: true;
      resolved: Map<number, ResolvedImportEntities>;
    }
  | {
      ok: false;
      missingAgents: string[];
      missingAuditors: string[];
      missingTeams: string[];
      summary: string;
    };

function nameKey(value: string): string {
  return normalizeAgentName(value).nameKey;
}

function buildLookup(entries: ImportEntityRef[]): Map<string, ImportEntityRef> {
  const map = new Map<string, ImportEntityRef>();
  for (const entry of entries) {
    if (!map.has(entry.nameKey)) {
      map.set(entry.nameKey, entry);
    }
  }
  return map;
}

function buildTeamLookup(teams: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of teams) {
    const key = nameKey(team);
    if (!map.has(key)) map.set(key, team);
  }
  return map;
}

export function matchAgentName(
  raw: string,
  catalog: ImportEntityCatalog
): ImportEntityRef | null {
  const key = nameKey(raw);
  if (!key) return null;
  return buildLookup(catalog.agents).get(key) ?? null;
}

export function matchAuditorName(
  raw: string,
  catalog: ImportEntityCatalog
): ImportEntityRef | null {
  const key = nameKey(raw);
  if (!key) return null;
  return buildLookup(catalog.auditors).get(key) ?? null;
}

export function matchTeamName(
  raw: string,
  catalog: ImportEntityCatalog
): string | null {
  const key = nameKey(raw);
  if (!key) return null;
  const fromTeams = buildTeamLookup(catalog.teams).get(key);
  if (fromTeams) return fromTeams;
  return catalog.supervisorNameToTeam[key] ?? null;
}

/**
 * Per-row entity checks used by client preview and server import.
 * Team Name is ignored for validation — only Agent + Quality Auditor must exist.
 */
export function entityErrorsForRow(
  input: {
    agent: string;
    auditor: string;
    teamName?: string;
  },
  catalog: ImportEntityCatalog
): string[] {
  const errors: string[] = [];
  const agent = input.agent.trim();
  const auditor = input.auditor.trim();

  if (!agent) {
    errors.push("Agent Name is required.");
  } else if (!matchAgentName(agent, catalog)) {
    errors.push(`Agent "${agent}" not found in the database.`);
  }

  if (!auditor) {
    errors.push("Quality Auditor is required.");
  } else if (!matchAuditorName(auditor, catalog)) {
    errors.push(`Quality Auditor "${auditor}" not found in the database.`);
  }

  return errors;
}

/**
 * All-or-nothing entity validation for an import batch.
 * Missing Agent / Quality Auditor blocks the entire import.
 * Team Name is accepted as free text (not checked in DB).
 */
export function validateImportEntities(
  rows: Array<{
    rowNumber: number;
    agent: string;
    auditor: string;
    teamName: string;
  }>,
  catalog: ImportEntityCatalog
): ImportEntityValidation {
  const missingAgents = new Set<string>();
  const missingAuditors = new Set<string>();
  const resolved = new Map<number, ResolvedImportEntities>();

  for (const row of rows) {
    const agentRaw = row.agent.trim();
    const auditorRaw = row.auditor.trim();
    const teamRaw = row.teamName.trim();

    const agent = agentRaw ? matchAgentName(agentRaw, catalog) : null;
    const auditor = auditorRaw ? matchAuditorName(auditorRaw, catalog) : null;
    // Prefer canonical team if it happens to match; otherwise keep sheet value.
    const teamName = teamRaw
      ? matchTeamName(teamRaw, catalog) ?? teamRaw
      : "";

    if (!agentRaw) missingAgents.add("(blank)");
    else if (!agent) missingAgents.add(agentRaw);

    if (!auditorRaw) missingAuditors.add("(blank)");
    else if (!auditor) missingAuditors.add(auditorRaw);

    if (agent && auditor) {
      resolved.set(row.rowNumber, {
        agentName: agent.name,
        auditorName: auditor.name,
        teamName,
      });
    }
  }

  if (missingAgents.size > 0 || missingAuditors.size > 0) {
    const parts: string[] = [];
    if (missingAgents.size > 0) {
      parts.push(`Agents: ${[...missingAgents].join(", ")}`);
    }
    if (missingAuditors.size > 0) {
      parts.push(`Quality Auditors: ${[...missingAuditors].join(", ")}`);
    }
    return {
      ok: false,
      missingAgents: [...missingAgents],
      missingAuditors: [...missingAuditors],
      missingTeams: [],
      summary: `Import blocked — create these in Settings first. ${parts.join(" · ")}`,
    };
  }

  return { ok: true, resolved };
}
