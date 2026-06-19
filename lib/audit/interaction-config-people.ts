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
import {
  fetchQmVisibleAgentNames,
  fetchSupervisorNamesForAgentUserIds,
  fetchSupervisorTierVisibleAgentNames,
  fetchVisibleAgentUserIds,
} from "@/lib/audit/agent-assignment-scope";
import { isSuperAdmin } from "@/lib/rbac";
import {
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";

const GLOBAL_DATA_ROLES = new Set<SystemRoleSlug>([
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
  SYSTEM_ROLE_SLUGS.ADMIN,
]);

async function resolveVisibleAgentNames(ctx: DataScopeContext): Promise<string[]> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return fetchActiveAgentUserNames();
  }

  const slug = ctx.role.slug as SystemRoleSlug;

  if (slug === SYSTEM_ROLE_SLUGS.SUPERVISOR) {
    return fetchSupervisorTierVisibleAgentNames(ctx.userId);
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) {
    return fetchQmVisibleAgentNames(ctx.userId);
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return fetchSupervisorTierVisibleAgentNames(ctx.userId);
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

  if (slug === SYSTEM_ROLE_SLUGS.SUPERVISOR) {
    const self = effectiveScopeName(ctx);
    return self ? [self] : [];
  }

  const agentUserIds = await fetchVisibleAgentUserIds(ctx.userId, slug);
  const linked = await fetchSupervisorNamesForAgentUserIds(agentUserIds);
  if (linked.length > 0) {
    return linked;
  }

  if (slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER || slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return [];
  }

  return fetchActiveSupervisorUserNames();
}

async function resolveVisibleAuditorNames(ctx: DataScopeContext): Promise<string[]> {
  if (isSuperAdmin(ctx.role) || GLOBAL_DATA_ROLES.has(ctx.role.slug as SystemRoleSlug)) {
    return fetchActiveQualityAnalystUserNames();
  }

  if (ctx.role.slug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    const self = effectiveScopeName(ctx);
    return self ? [self] : [];
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
