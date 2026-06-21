import {
  fetchAgentRosterIds,
  fetchAgentRosterNames,
  fetchAssignedAgentEntries,
} from "@/lib/audit/agent-roster";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

export {
  fetchAgentRosterNames,
  fetchQmApprovedAgentUserIds,
  fetchQmAssignedAgentUserIds,
  fetchSupervisorNamesForAgentUserIds,
} from "@/lib/audit/agent-roster";

export async function fetchAssignedAgentUserIds(assignedToId: string) {
  const entries = await fetchAssignedAgentEntries(assignedToId);
  return entries.map((entry) => entry.id);
}

export async function fetchAssignedAgentNames(assignedToId: string) {
  const entries = await fetchAssignedAgentEntries(assignedToId);
  return entries.map((entry) => entry.name);
}

export async function fetchQmVisibleAgentNames(qualityManagerId: string) {
  return fetchAgentRosterNames(
    qualityManagerId,
    SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  );
}

export async function fetchSupervisorTierVisibleAgentNames(
  userId: string,
  roleSlug: string = SYSTEM_ROLE_SLUGS.SUPERVISOR
) {
  return fetchAgentRosterNames(userId, roleSlug);
}

export async function fetchVisibleAgentUserIds(
  userId: string,
  roleSlug: string
): Promise<string[]> {
  return fetchAgentRosterIds(userId, roleSlug);
}
