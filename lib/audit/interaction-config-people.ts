import type { InteractionConfig } from "@/lib/audit/types";
import {
  fetchActiveAgentUserNames,
  fetchActiveQualityAnalystUserNames,
  fetchActiveSupervisorUserNames,
  resolveRoleUserName,
} from "@/lib/audit/role-users";
import {
  type DataScopeContext,
  effectiveScopeName,
} from "@/lib/audit/data-scope";
import { fetchAgentRosterNames } from "@/lib/audit/agent-roster";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";
import {
  fetchSupervisorNamesForAgentUserIds,
  fetchVisibleAgentUserIds,
} from "@/lib/audit/agent-assignment-scope";
import { isSuperAdmin, hasScope } from "@/lib/rbac";
import {
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import {
  fetchMemberGrantedAgentNames,
  fetchMemberGrantedQaNames,
  fetchMemberGrantedTargetUserIds,
} from "@/lib/audit/member-access";

const GLOBAL_DATA_ROLES = new Set<SystemRoleSlug>([
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
  SYSTEM_ROLE_SLUGS.ADMIN,
]);

async function resolveVisibleAgentNames(ctx: DataScopeContext): Promise<string[]> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return fetchActiveAgentUserNames();
  }

  const slug = ctx.role.slug as SystemRoleSlug;

  if (isSupervisorTierRole(slug)) {
    return fetchAgentRosterNames(ctx.userId, slug);
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    return fetchAgentRosterNames(ctx.userId, SYSTEM_ROLE_SLUGS.QUALITY_MANAGER);
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return fetchAgentRosterNames(ctx.userId, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST);
  }

  if (slug === SYSTEM_ROLE_SLUGS.AGENT) {
    const self = effectiveScopeName(ctx);
    return self ? [self] : [];
  }

  if (slug === SYSTEM_ROLE_SLUGS.MEMBER) {
    const { qaIds } = await fetchMemberGrantedTargetUserIds(ctx.userId);
    const [grantedAgents, ...qaRosters] = await Promise.all([
      fetchMemberGrantedAgentNames(ctx.userId),
      ...qaIds.map((qaId) =>
        fetchAgentRosterNames(qaId, SYSTEM_ROLE_SLUGS.QUALITY_ANALYST)
      ),
    ]);
    return [...new Set([...grantedAgents, ...qaRosters.flat()])].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  return [];
}

async function resolveVisibleSupervisorNames(
  ctx: DataScopeContext
): Promise<string[]> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return fetchActiveSupervisorUserNames();
  }

  const slug = ctx.role.slug as SystemRoleSlug;

  if (isSupervisorTierRole(slug)) {
    const self = effectiveScopeName(ctx);
    return self ? [self] : [];
  }

  const agentUserIds = await fetchVisibleAgentUserIds(ctx.userId, slug);
  const linked = await fetchSupervisorNamesForAgentUserIds(agentUserIds);
  if (linked.length > 0) {
    return linked;
  }

  if (
    slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER ||
    slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
  ) {
    // Agents provisioned by a QA (not a supervisor) still need a supervisor field.
    if (agentUserIds.length > 0) {
      return fetchActiveSupervisorUserNames();
    }
    return [];
  }

  if (slug === SYSTEM_ROLE_SLUGS.MEMBER) {
    const { agentIds, qaIds } = await fetchMemberGrantedTargetUserIds(ctx.userId);
    const visibleAgentIds = new Set<string>(agentIds);
    for (const qaId of qaIds) {
      const rosterIds = await fetchVisibleAgentUserIds(
        qaId,
        SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
      );
      for (const id of rosterIds) visibleAgentIds.add(id);
    }
    const linked = await fetchSupervisorNamesForAgentUserIds([...visibleAgentIds]);
    if (linked.length > 0) return linked;
    if (visibleAgentIds.size > 0) {
      return fetchActiveSupervisorUserNames();
    }
    return [];
  }

  return [];
}

async function resolveVisibleAuditorNames(ctx: DataScopeContext): Promise<string[]> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return fetchActiveQualityAnalystUserNames();
  }

  if (ctx.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    const self = effectiveScopeName(ctx);
    return self ? [self] : [];
  }

  if (ctx.role.slug === SYSTEM_ROLE_SLUGS.MEMBER) {
    return fetchMemberGrantedQaNames(ctx.userId);
  }

  if (
    isSupervisorTierRole(ctx.role.slug) &&
    hasScope(ctx.role, PERMISSIONS.AUDIT_FORM_WRITE)
  ) {
    const self = effectiveScopeName(ctx);
    const analysts = await fetchActiveQualityAnalystUserNames();
    const merged = new Set<string>(analysts);
    if (self) merged.add(self);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }

  return fetchActiveQualityAnalystUserNames();
}

/** Injects live, session-scoped User rosters into interaction config. */
export async function enrichInteractionConfigForSession(
  config: InteractionConfig,
  ctx: DataScopeContext
): Promise<InteractionConfig> {
  const [agents, supervisors, auditors] = await Promise.all([
    resolveVisibleAgentNames(ctx),
    resolveVisibleSupervisorNames(ctx),
    resolveVisibleAuditorNames(ctx),
  ]);

  return {
    ...config,
    agents,
    supervisors,
    auditors,
  };
}

/** @deprecated Use enrichInteractionConfigForSession with session context. */
export async function enrichInteractionConfigWithRoleUsers(
  config: InteractionConfig
): Promise<InteractionConfig> {
  const [agents, supervisors, auditors] = await Promise.all([
    fetchActiveAgentUserNames(),
    fetchActiveSupervisorUserNames(),
    fetchActiveQualityAnalystUserNames(),
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

export type FormsScopeSummary = {
  agentCount: number;
  supervisorCount: number;
  analystCount: number;
  roleLabel: string;
};

export async function buildFormsScopeSummary(
  ctx: DataScopeContext
): Promise<FormsScopeSummary> {
  const [agents, supervisors, auditors] = await Promise.all([
    resolveVisibleAgentNames(ctx),
    resolveVisibleSupervisorNames(ctx),
    resolveVisibleAuditorNames(ctx),
  ]);

  return {
    agentCount: agents.length,
    supervisorCount: supervisors.length,
    analystCount: auditors.length,
    roleLabel: ctx.role.name,
  };
}

export { resolveRoleUserName };
