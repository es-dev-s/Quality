import {
  PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_SLUGS,
  type Permission,
  type SystemRoleSlug,
} from "@/lib/permissions";
import { isSuperAdmin, type SessionRole } from "@/lib/rbac";

export type ModuleKey =
  | "overview"
  | "auditLogs"
  | "analytics"
  | "reports"
  | "auditForm"
  | "auditTemplates"
  | "settings"
  | "team"
  | "feedback";

export type ModuleAccessCell =
  | "—"
  | "Read"
  | "Read/Write"
  | "Change status"
  | "Partial";

export const ACCESS_MODULES: {
  key: ModuleKey;
  label: string;
  shortLabel: string;
}[] = [
  { key: "overview", label: "Overview", shortLabel: "Overview" },
  { key: "auditLogs", label: "Audit Logs", shortLabel: "Audit Logs" },
  { key: "analytics", label: "Analytics", shortLabel: "Analytics" },
  { key: "reports", label: "Reports", shortLabel: "Reports" },
  { key: "auditForm", label: "Audit Form", shortLabel: "Audit Form" },
  { key: "auditTemplates", label: "Audit Templates", shortLabel: "Templates" },
  { key: "settings", label: "Settings", shortLabel: "Settings" },
  { key: "team", label: "Team management", shortLabel: "Team" },
  { key: "feedback", label: "Feedback", shortLabel: "Feedback" },
];

/** Row-level audit data visibility (enforced in addition to module scopes). */
export const DATA_VISIBILITY: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: "Own audit records only",
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]:
    "Agents created or assigned to this supervisor (after QM approval)",
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]:
    "Audits for aligned agents and records where this user is the analyst",
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]:
    "Agents approved or assigned by this manager",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "All audit records",
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: "All audit records",
};

export const ACCESS_SCOPE_LABEL: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: "Read",
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: "Read",
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: "Read",
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: "Partial",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Partial",
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: "Full access",
};

const TEAM_WRITE_SCOPES: Permission[] = [
  PERMISSIONS.USERS_MANAGE_MANAGED,
  PERMISSIONS.USERS_APPROVE_AGENT,
  PERMISSIONS.USERS_APPROVE_ANALYST,
  PERMISSIONS.AGENT_ASSIGN,
  PERMISSIONS.ADMIN_USERS,
  PERMISSIONS.ADMIN_ROLES,
];

const TEAM_READ_SCOPES: Permission[] = [
  PERMISSIONS.USERS_PROVISION_AGENT,
  PERMISSIONS.USERS_PROVISION_ANALYST,
  PERMISSIONS.USERS_READ_MANAGED,
];

function has(role: SessionRole | SystemRoleSlug, permission: Permission): boolean {
  if (typeof role === "string") {
    const def = SYSTEM_ROLE_DEFINITIONS[role as SystemRoleSlug];
    return def?.permissions.includes(permission) ?? false;
  }
  if (isSuperAdmin(role)) return true;
  return role.scopes.includes(permission);
}

function hasAny(role: SessionRole | SystemRoleSlug, permissions: Permission[]): boolean {
  return permissions.some((permission) => has(role, permission));
}

function moduleAccess(
  role: SessionRole | SystemRoleSlug,
  readPerm: Permission,
  writePerm: Permission
): ModuleAccessCell {
  const canWrite = has(role, writePerm);
  const canRead = has(role, readPerm);
  if (canWrite) return "Read/Write";
  if (canRead) return "Read";
  return "—";
}

function readOnlyModuleAccess(
  role: SessionRole | SystemRoleSlug,
  readPerm: Permission
): ModuleAccessCell {
  return has(role, readPerm) ? "Read" : "—";
}

function settingsAccess(role: SessionRole | SystemRoleSlug): ModuleAccessCell {
  if (has(role, PERMISSIONS.SETTINGS_WRITE)) return "Read/Write";
  if (!has(role, PERMISSIONS.SETTINGS_READ)) return "—";
  if (hasAny(role, TEAM_READ_SCOPES) || hasAny(role, TEAM_WRITE_SCOPES)) {
    return "Partial";
  }
  return "Read";
}

function teamAccess(role: SessionRole | SystemRoleSlug): ModuleAccessCell {
  if (
    (typeof role === "string" && role === SYSTEM_ROLE_SLUGS.SUPERADMIN) ||
    (typeof role !== "string" && isSuperAdmin(role))
  ) {
    return "Read/Write";
  }
  if (has(role, PERMISSIONS.ADMIN_USERS) || has(role, PERMISSIONS.ADMIN_ROLES)) {
    return "Read/Write";
  }
  if (hasAny(role, TEAM_WRITE_SCOPES)) return "Read/Write";
  if (hasAny(role, TEAM_READ_SCOPES)) return "Partial";
  return "—";
}

function feedbackAccess(role: SessionRole | SystemRoleSlug): ModuleAccessCell {
  if (has(role, PERMISSIONS.FEEDBACK_WRITE)) return "Read/Write";
  if (has(role, PERMISSIONS.FEEDBACK_STATUS)) return "Change status";
  if (has(role, PERMISSIONS.FEEDBACK_READ)) return "Read";
  return "—";
}

export function getModuleAccessMatrix(
  role: SessionRole | SystemRoleSlug
): Record<ModuleKey, ModuleAccessCell> {
  return {
    overview: readOnlyModuleAccess(role, PERMISSIONS.OVERVIEW_READ),
    auditLogs: moduleAccess(
      role,
      PERMISSIONS.AUDIT_LOGS_READ,
      PERMISSIONS.AUDIT_LOGS_WRITE
    ),
    analytics: readOnlyModuleAccess(role, PERMISSIONS.ANALYTICS_READ),
    reports: readOnlyModuleAccess(role, PERMISSIONS.REPORTS_READ),
    auditForm: moduleAccess(
      role,
      PERMISSIONS.AUDIT_FORM_READ,
      PERMISSIONS.AUDIT_FORM_WRITE
    ),
    auditTemplates: moduleAccess(
      role,
      PERMISSIONS.AUDIT_TEMPLATES_READ,
      PERMISSIONS.AUDIT_TEMPLATES_WRITE
    ),
    settings: settingsAccess(role),
    team: teamAccess(role),
    feedback: feedbackAccess(role),
  };
}

export const SYSTEM_ROLE_ORDER: SystemRoleSlug[] = [
  SYSTEM_ROLE_SLUGS.AGENT,
  SYSTEM_ROLE_SLUGS.SUPERVISOR,
  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.SUPERADMIN,
];

/** Expected matrix rows — used for regression checks. */
export const EXPECTED_SYSTEM_ROLE_MATRIX: Record<
  SystemRoleSlug,
  Partial<Record<ModuleKey, ModuleAccessCell>>
> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: {
    overview: "Read",
    auditLogs: "Read",
    analytics: "Read",
    feedback: "Change status",
  },
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: {
    overview: "Read",
    auditLogs: "Read",
    analytics: "Read",
    settings: "Partial",
    team: "Read/Write",
    feedback: "Read",
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: {
    overview: "Read",
    auditLogs: "Read",
    analytics: "Read",
    auditForm: "Read/Write",
    settings: "Partial",
    team: "Read/Write",
    feedback: "Change status",
  },
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: {
    overview: "Read",
    auditLogs: "Read/Write",
    analytics: "Read",
    reports: "Read",
    auditForm: "Read/Write",
    auditTemplates: "Read",
    settings: "Partial",
    team: "Read/Write",
    feedback: "Read",
  },
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    overview: "Read",
    auditLogs: "Read",
    analytics: "Read",
    reports: "Read",
    auditForm: "Read/Write",
    auditTemplates: "Read/Write",
    settings: "Read/Write",
    team: "Read/Write",
    feedback: "Read",
  },
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: {
    overview: "Read",
    auditLogs: "Read/Write",
    analytics: "Read",
    reports: "Read",
    auditForm: "Read/Write",
    auditTemplates: "Read/Write",
    settings: "Read/Write",
    team: "Read/Write",
    feedback: "Read/Write",
  },
};

export function verifySystemRoleMatrix(): string[] {
  const errors: string[] = [];
  for (const slug of SYSTEM_ROLE_ORDER) {
    const matrix = getModuleAccessMatrix(slug);
    const expected = EXPECTED_SYSTEM_ROLE_MATRIX[slug];
    for (const [key, value] of Object.entries(expected) as [
      ModuleKey,
      ModuleAccessCell,
    ][]) {
      if (matrix[key] !== value) {
        errors.push(`${slug}.${key}: expected ${value}, got ${matrix[key]}`);
      }
    }
    for (const module of ACCESS_MODULES) {
      if (expected[module.key] === undefined && matrix[module.key] !== "—") {
        errors.push(`${slug}.${module.key}: expected —, got ${matrix[module.key]}`);
      }
    }
  }
  return errors;
}
