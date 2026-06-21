import {
  fetchProvisionedAgentNamesBySupervisorUserIds,
  filterAgentNamesToVisibleSet,
} from "@/lib/audit/agent-roster";
import { resolveRoleUserName } from "@/lib/audit/role-users";
import { SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "@/lib/permissions";
import { isSuperAdmin, type SessionRole } from "@/lib/rbac";
import { withActiveUserFilter } from "@/lib/user-active-filter";
import { prisma } from "@/lib/prisma";

type SessionLike = {
  user: {
    id: string;
    role: { slug: string; scopes?: string[] };
  };
};

const GLOBAL_FORM_ROLES = new Set<SystemRoleSlug>([
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
  SYSTEM_ROLE_SLUGS.ADMIN,
]);

function sortUnique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function viewerBypassesAgentFilter(roleSlug: string): boolean {
  return (
    GLOBAL_FORM_ROLES.has(roleSlug as SystemRoleSlug) ||
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN
  );
}

/**
 * Maps supervisor display name → agent names for the audit form.
 *
 * - Each supervisor lists active agents they provisioned.
 * - QA / QM viewers only see agents that also appear in their session roster.
 * - Admin / superadmin see the full provisioned list per supervisor.
 */
export async function buildSupervisorAgentMap(
  session: SessionLike,
  supervisors: string[],
  viewerVisibleAgents: string[]
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  for (const name of supervisors) {
    map[name] = [];
  }

  if (supervisors.length === 0) {
    return map;
  }

  const roleSlug = session.user.role.slug;
  const role = session.user.role as SessionRole;
  const restrictToViewer =
    !viewerBypassesAgentFilter(roleSlug) && !isSuperAdmin(role);

  const supervisorUsers = await prisma.user.findMany({
    where: withActiveUserFilter({
      role: { slug: SYSTEM_ROLE_SLUGS.SUPERVISOR },
    }),
    select: { id: true, name: true, email: true },
  });

  const idByDisplayName = new Map<string, string>();
  for (const user of supervisorUsers) {
    idByDisplayName.set(resolveRoleUserName(user), user.id);
  }

  const supervisorIds = supervisors
    .map((name) => idByDisplayName.get(name.trim()))
    .filter((id): id is string => Boolean(id));

  const provisionedBySupervisor =
    await fetchProvisionedAgentNamesBySupervisorUserIds(supervisorIds);

  for (const supervisorName of supervisors) {
    const userId = idByDisplayName.get(supervisorName.trim());
    if (!userId) continue;

    const provisioned = provisionedBySupervisor.get(userId) ?? [];
    map[supervisorName] = sortUnique(
      restrictToViewer
        ? filterAgentNamesToVisibleSet(provisioned, viewerVisibleAgents)
        : provisioned
    );
  }

  return map;
}

/** Roles that can open /forms/audit (audit-form:read). */
export const AUDIT_FORM_ACCESS_ROLES: SystemRoleSlug[] = [
  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
];

/** Expected supervisor → agent behaviour per form-capable role. */
export const FORM_SUPERVISOR_AGENT_RULES: Record<
  SystemRoleSlug,
  { canAccessForm: boolean; supervisorScope: string; agentScope: string }
> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: {
    canAccessForm: false,
    supervisorScope: "—",
    agentScope: "—",
  },
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: {
    canAccessForm: false,
    supervisorScope: "—",
    agentScope: "—",
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: {
    canAccessForm: true,
    supervisorScope:
      "Supervisors who provisioned agents in the QA roster; all active supervisors if none linked",
    agentScope:
      "When a supervisor is selected: that supervisor's provisioned agents ∩ QA roster",
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: {
    canAccessForm: true,
    supervisorScope:
      "Supervisors who provisioned agents in the QM roster; all active supervisors if none linked",
    agentScope:
      "When a supervisor is selected: that supervisor's provisioned agents ∩ QM roster",
  },
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    canAccessForm: true,
    supervisorScope: "All active supervisors",
    agentScope:
      "When a supervisor is selected: all active agents that supervisor provisioned",
  },
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: {
    canAccessForm: true,
    supervisorScope: "All active supervisors",
    agentScope:
      "When a supervisor is selected: all active agents that supervisor provisioned",
  },
};
