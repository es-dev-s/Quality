import { SUPERADMIN_ROLE_SLUG } from "@/lib/constants";

/** Module permission slugs stored in Scope.slug and JWT session. */
export const PERMISSIONS = {
  OVERVIEW_READ: "overview:read",
  AUDIT_LOGS_READ: "audit-logs:read",
  AUDIT_LOGS_WRITE: "audit-logs:write",
  ANALYTICS_READ: "analytics:read",
  REPORTS_READ: "reports:read",
  AUDIT_FORM_READ: "audit-form:read",
  AUDIT_FORM_WRITE: "audit-form:write",
  AUDIT_TEMPLATES_READ: "audit-templates:read",
  AUDIT_TEMPLATES_WRITE: "audit-templates:write",
  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",
  FEEDBACK_READ: "feedback:read",
  FEEDBACK_STATUS: "feedback:status",
  FEEDBACK_WRITE: "feedback:write",
  IMPORT_WRITE: "import:write",
  ADMIN_USERS: "admin:users",
  ADMIN_ROLES: "admin:roles",
  USERS_PROVISION_AGENT: "users:provision-agent",
  USERS_APPROVE_AGENT: "users:approve-agent",
  USERS_PROVISION_ANALYST: "users:provision-analyst",
  USERS_APPROVE_ANALYST: "users:approve-analyst",
  USERS_READ_MANAGED: "users:read-managed",
  USERS_MANAGE_MANAGED: "users:manage-managed",
  AGENT_ASSIGN: "users:assign-agent",
  USER_READ_SENSITIVE: "admin:user-sensitive",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Scopes persisted to DB — excludes reserved/legacy slugs not enforced in code. */
export const SEED_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Canonical spec roles (5). */
export const CANONICAL_ROLE_SLUGS = [
  "superadmin",
  "quality-manager",
  "supervisor",
  "quality-analyst",
  "agent",
] as const;

/**
 * Legacy operational role — analyst provisioning approver + template admin.
 * Not part of the 5-role canonical spec; retained for existing deployments.
 */
export const LEGACY_ADMIN_ROLE_SLUG = "admin" as const;

/** Team-management tier for supervisors (no audit forms). */
export const SUPERVISOR_TIER_PERMISSIONS: Permission[] = [
  PERMISSIONS.OVERVIEW_READ,
  PERMISSIONS.AUDIT_LOGS_READ,
  PERMISSIONS.ANALYTICS_READ,
  PERMISSIONS.FEEDBACK_READ,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.USERS_PROVISION_AGENT,
  PERMISSIONS.USERS_READ_MANAGED,
  PERMISSIONS.USERS_MANAGE_MANAGED,
];

/** Quality Analyst: supervisor tier + audit forms + feedback status changes. */
export const QUALITY_ANALYST_TIER_PERMISSIONS: Permission[] = [
  ...SUPERVISOR_TIER_PERMISSIONS,
  PERMISSIONS.AUDIT_FORM_READ,
  PERMISSIONS.AUDIT_FORM_WRITE,
  PERMISSIONS.FEEDBACK_STATUS,
];

export const SYSTEM_ROLE_SLUGS = {
  AGENT: "agent",
  SUPERVISOR: "supervisor",
  QUALITY_ANALYST: "quality-analyst",
  QUALITY_MANAGER: "quality-manager",
  ADMIN: LEGACY_ADMIN_ROLE_SLUG,
  SUPERADMIN: SUPERADMIN_ROLE_SLUG,
} as const;

export type SystemRoleSlug =
  (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS];

type RoleDefinition = {
  name: string;
  description: string;
  permissions: Permission[];
  legacy?: boolean;
};

export const SYSTEM_ROLE_DEFINITIONS: Record<SystemRoleSlug, RoleDefinition> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: {
    name: "Agent",
    description:
      "Views own audit records. Can update feedback status on assigned audits.",
    permissions: [
      PERMISSIONS.OVERVIEW_READ,
      PERMISSIONS.AUDIT_LOGS_READ,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.FEEDBACK_STATUS,
    ],
  },
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: {
    name: "Supervisor",
    description:
      "Team-management tier: onboard agents (QM approval), view scoped audits.",
    permissions: [...SUPERVISOR_TIER_PERMISSIONS],
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: {
    name: "Quality Analyst",
    description:
      "Team management and audit forms for aligned agents.",
    permissions: [...QUALITY_ANALYST_TIER_PERMISSIONS],
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: {
    name: "Quality Manager",
    description:
      "Approves agent requests and assigns agents to quality analysts.",
    permissions: [
      PERMISSIONS.OVERVIEW_READ,
      PERMISSIONS.AUDIT_LOGS_READ,
      PERMISSIONS.AUDIT_LOGS_WRITE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.AUDIT_FORM_READ,
      PERMISSIONS.AUDIT_FORM_WRITE,
      PERMISSIONS.AUDIT_TEMPLATES_READ,
      PERMISSIONS.FEEDBACK_READ,
      PERMISSIONS.FEEDBACK_STATUS,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.USERS_APPROVE_AGENT,
      PERMISSIONS.USERS_PROVISION_ANALYST,
      PERMISSIONS.USERS_READ_MANAGED,
      PERMISSIONS.USERS_MANAGE_MANAGED,
      PERMISSIONS.AGENT_ASSIGN,
    ],
  },
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    name: "Admin (legacy)",
    description:
      "Legacy operational admin — templates/settings. Prefer superadmin for user RBAC.",
    legacy: true,
    permissions: [
      PERMISSIONS.OVERVIEW_READ,
      PERMISSIONS.AUDIT_LOGS_READ,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.AUDIT_FORM_READ,
      PERMISSIONS.AUDIT_FORM_WRITE,
      PERMISSIONS.AUDIT_TEMPLATES_READ,
      PERMISSIONS.AUDIT_TEMPLATES_WRITE,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE,
      PERMISSIONS.FEEDBACK_READ,
      PERMISSIONS.USERS_APPROVE_ANALYST,
    ],
  },
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: {
    name: "Super Admin",
    description: "Full platform access including users, roles, and import.",
    permissions: SEED_PERMISSIONS,
  },
};

export function isDefinedSystemRole(slug: string): slug is SystemRoleSlug {
  return Object.prototype.hasOwnProperty.call(SYSTEM_ROLE_DEFINITIONS, slug);
}

/** System roles use code definitions; custom roles use DB-assigned scopes. */
export function resolveEffectiveScopes(
  roleSlug: string,
  dbScopeSlugs: string[]
): Permission[] {
  if (isDefinedSystemRole(roleSlug)) {
    return [...SYSTEM_ROLE_DEFINITIONS[roleSlug].permissions];
  }

  return dbScopeSlugs.filter((slug): slug is Permission =>
    (SEED_PERMISSIONS as readonly string[]).includes(slug)
  );
}

/** Minimum permission required to open a route (read access). */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  "/dashboard": PERMISSIONS.OVERVIEW_READ,
  "/audit-logs": PERMISSIONS.AUDIT_LOGS_READ,
  "/analytics": PERMISSIONS.ANALYTICS_READ,
  "/reports": PERMISSIONS.REPORTS_READ,
  "/forms": PERMISSIONS.AUDIT_FORM_READ,
  "/forms/audit": PERMISSIONS.AUDIT_FORM_READ,
  "/forms/templates": PERMISSIONS.AUDIT_TEMPLATES_READ,
  "/settings": PERMISSIONS.SETTINGS_READ,
  "/import": PERMISSIONS.IMPORT_WRITE,
};

export function resolveRoutePermission(pathname: string): Permission | null {
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname];
  }

  if (pathname.startsWith("/audit-logs/")) {
    return PERMISSIONS.AUDIT_LOGS_READ;
  }
  if (pathname.startsWith("/forms/audit")) {
    return PERMISSIONS.AUDIT_FORM_READ;
  }
  if (pathname.startsWith("/forms/templates")) {
    return PERMISSIONS.AUDIT_TEMPLATES_READ;
  }
  if (pathname.startsWith("/forms")) {
    return PERMISSIONS.AUDIT_FORM_READ;
  }

  return null;
}

export function isLegacySystemRole(slug: string): boolean {
  return slug === LEGACY_ADMIN_ROLE_SLUG;
}
