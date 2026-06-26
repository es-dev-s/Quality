import {
  isDefinedSystemRole,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";

/** Roles whose roster can include multiple agents (see agent-roster.ts). */
const MULTI_AGENT_FILTER_ROLE_SLUGS: ReadonlySet<SystemRoleSlug> = new Set([
  SYSTEM_ROLE_SLUGS.SUPERVISOR,
  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
]);

/** Whether the filter sidebar should offer an agent picker for this role. */
export function canFilterByAgent(roleSlug: string): boolean {
  return (
    isDefinedSystemRole(roleSlug) &&
    MULTI_AGENT_FILTER_ROLE_SLUGS.has(roleSlug)
  );
}

export function buildAgentFilterSelectOptions(agentNames: string[]) {
  return [
    { value: "", label: "All agents" },
    ...agentNames.map((name) => ({ value: name, label: name })),
  ];
}

export function matchesAgentFilter(
  recordAgent: string,
  selectedAgent: string
): boolean {
  if (!selectedAgent) return true;
  return recordAgent === selectedAgent;
}
