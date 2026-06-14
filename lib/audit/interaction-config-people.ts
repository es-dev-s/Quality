import type { InteractionConfig } from "@/lib/audit/types";
import {
  fetchActiveAgentUserNames,
  fetchActiveAuditorUserNames,
  fetchActiveSupervisorUserNames,
} from "@/lib/audit/role-users";

/** Injects live User rosters into interaction config (not stored in JSON). */
export async function enrichInteractionConfigWithRoleUsers(
  config: InteractionConfig
): Promise<InteractionConfig> {
  const [agents, supervisors, auditors] = await Promise.all([
    fetchActiveAgentUserNames(),
    fetchActiveSupervisorUserNames(),
    fetchActiveAuditorUserNames(),
  ]);

  return {
    ...config,
    agents,
    supervisors,
    auditors,
  };
}

/** Strip people lists before persisting interaction config JSON. */
export function stripInteractionPeopleLists(config: InteractionConfig) {
  const { agents: _a, supervisors: _s, auditors: _au, ...rest } = config;
  return rest;
}
