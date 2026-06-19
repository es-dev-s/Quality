import {
  PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_SLUGS,
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
  { key: "feedback", label: "Feedback", shortLabel: "Feedback" },
];

export const DATA_VISIBILITY: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: "Only particular agent details",
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]:
    "Agents onboarded by this supervisor (after QM approval)",
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: "Aligned agent details only",
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]:
    "Quality analysts onboarded by this manager (after admin approval)",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Full view with selective modification",
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: "Full access to all records",
};

export const ACCESS_SCOPE_LABEL: Record<SystemRoleSlug, string> = {
  [SYSTEM_ROLE_SLUGS.AGENT]: "Read",
  [SYSTEM_ROLE_SLUGS.SUPERVISOR]: "Read",
  [SYSTEM_ROLE_SLUGS.QUALITY_ANALYST]: "Read",
  [SYSTEM_ROLE_SLUGS.QUALITY_MANAGER]: "Partial",
  [SYSTEM_ROLE_SLUGS.ADMIN]: "Partial",
  [SYSTEM_ROLE_SLUGS.SUPERADMIN]: "Full access",
};

function has(role: SessionRole | SystemRoleSlug, permission: string): boolean {
  if (typeof role === "string") {
    const def = SYSTEM_ROLE_DEFINITIONS[role as SystemRoleSlug];
    return def?.permissions.includes(permission as never) ?? false;
  }
  if (isSuperAdmin(role)) return true;
  return role.scopes.includes(permission);
}

function moduleAccess(
  role: SessionRole | SystemRoleSlug,
  readPerm: string,
  writePerm: string
): ModuleAccessCell {
  const canWrite = has(role, writePerm);
  const canRead = has(role, readPerm);
  if (canWrite) return "Read/Write";
  if (canRead) return "Read";
  return "—";
}

/** Modules with read-only scopes (no separate :write permission). */
function readOnlyModuleAccess(
  role: SessionRole | SystemRoleSlug,
  readPerm: string
): ModuleAccessCell {
  return has(role, readPerm) ? "Read" : "—";
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
    settings: moduleAccess(
      role,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE
    ),
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
