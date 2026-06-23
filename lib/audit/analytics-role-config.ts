import {
  isDefinedSystemRole,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { DATA_VISIBILITY } from "@/lib/role-access-matrix";

export const ANALYTICS_TAB_IDS = [
  "overview",
  "parameters",
  "teams",
  "agents",
  "compliance",
  "auditors",
  "leaderboards",
] as const;

export type AnalyticsTabId = (typeof ANALYTICS_TAB_IDS)[number];

export const ANALYTICS_TAB_LABELS: Record<AnalyticsTabId, string> = {
  overview: "Overview",
  parameters: "Parameters",
  teams: "Teams",
  agents: "Agents",
  compliance: "Compliance",
  auditors: "Auditors",
  leaderboards: "Leaderboards",
};

const ALL_TABS: AnalyticsTabId[] = [...ANALYTICS_TAB_IDS];

const ROLE_ANALYTICS_TABS: Record<SystemRoleSlug, AnalyticsTabId[]> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: ["overview", "parameters", "compliance"],
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: [
    "overview",
    "parameters",
    "teams",
    "agents",
    "compliance",
    "leaderboards",
  ],
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: [
    "overview",
    "parameters",
    "teams",
    "agents",
    "compliance",
    "auditors",
    "leaderboards",
  ],
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: ALL_TABS,
  [SYSTEM_ROLE_SLUGS.ADMIN]: ALL_TABS,
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: ALL_TABS,
};

export function analyticsTabsForRole(roleSlug: string): AnalyticsTabId[] {
  if (isDefinedSystemRole(roleSlug)) {
    return ROLE_ANALYTICS_TABS[roleSlug];
  }
  return ALL_TABS;
}

export function getAnalyticsScopeDescription(roleSlug: string): string {
  if (isDefinedSystemRole(roleSlug)) {
    return DATA_VISIBILITY[roleSlug];
  }
  return "Scoped to your assigned audit records";
}

export function analyticsFilterVisibility(roleSlug: string): {
  agent: boolean;
  teamName: boolean;
  auditor: boolean;
} {
  if (roleSlug === SYSTEM_ROLE_SLUGS.AGENT) {
    return { agent: false, teamName: true, auditor: true };
  }
  return { agent: true, teamName: true, auditor: true };
}
