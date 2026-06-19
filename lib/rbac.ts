import { IMPORT_ENABLED, SUPERADMIN_ROLE_SLUG } from "@/lib/constants";
import {
  PERMISSIONS,
  resolveRoutePermission,
  ROUTE_PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_SLUGS,
  type Permission,
  type SystemRoleSlug,
} from "@/lib/permissions";

export type SessionRole = {
  id: string;
  name: string;
  slug: string;
  scopes: string[];
};

export function isSuperAdmin(role?: SessionRole | null): boolean {
  return role?.slug === SUPERADMIN_ROLE_SLUG;
}

export function hasScope(
  role: SessionRole | null | undefined,
  permission: Permission | string
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role)) return true;
  if (role.scopes.includes(permission)) return true;

  const slug = role.slug as SystemRoleSlug;
  const systemRole = SYSTEM_ROLE_DEFINITIONS[slug];
  if (systemRole?.permissions.includes(permission as Permission)) {
    return true;
  }

  return false;
}

export function hasAnyScope(
  role: SessionRole | null | undefined,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasScope(role, permission));
}

export function canReadModule(
  role: SessionRole | null | undefined,
  permission: Permission
): boolean {
  return hasScope(role, permission);
}

export function canWriteModule(
  role: SessionRole | null | undefined,
  readPermission: Permission,
  writePermission: Permission
): boolean {
  return hasScope(role, writePermission) || hasScope(role, readPermission.replace(":read", ":write"));
}

export function canAccessPath(
  role: SessionRole | null | undefined,
  pathname: string
): boolean {
  if (
    !IMPORT_ENABLED &&
    (pathname === "/import" || pathname.startsWith("/import/"))
  ) {
    return false;
  }

  const permission = resolveRoutePermission(pathname);
  if (!permission) return true;
  return hasScope(role, permission);
}

export function firstAccessiblePath(
  role: SessionRole | null | undefined
): string | null {
  for (const path of Object.keys(ROUTE_PERMISSIONS)) {
    if (canAccessPath(role, path)) {
      return path;
    }
  }
  return null;
}

export function canManageUsers(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.ADMIN_USERS);
}

export function canProvisionAgents(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_PROVISION_AGENT);
}

export function canApproveAgentRequests(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_APPROVE_AGENT);
}

export function canProvisionAnalysts(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_PROVISION_ANALYST);
}

export function canApproveAnalystRequests(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_APPROVE_ANALYST);
}

export function canReadManagedUsers(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_READ_MANAGED);
}

export function canManageManagedUsers(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.USERS_MANAGE_MANAGED);
}

export function canAccessTeamManagement(role?: SessionRole | null): boolean {
  if (!role) return false;
  return (
    canProvisionAgents(role) ||
    canProvisionAnalysts(role) ||
    canApproveAgentRequests(role) ||
    canApproveAnalystRequests(role) ||
    canReadManagedUsers(role)
  );
}

export function canManageRoles(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.ADMIN_ROLES);
}

export function canManageSettings(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.SETTINGS_WRITE);
}

export function canReadSettings(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.SETTINGS_READ);
}

export function canWriteAuditForm(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_FORM_WRITE);
}

export function canReadAuditForm(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_FORM_READ);
}

export function canWriteAuditLogs(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_LOGS_WRITE);
}

/** Edit saved audits from Audit Logs — needs log write + audit form write. */
export function canEditAuditSubmissions(role?: SessionRole | null): boolean {
  return canWriteAuditForm(role) && canWriteAuditLogs(role);
}

export function canReadAuditLogs(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_LOGS_READ);
}

/** Permanent audit deletion — super admin only. */
export function canDeleteAuditLogs(role?: SessionRole | null): boolean {
  return isSuperAdmin(role);
}

export function canWriteAuditTemplates(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_TEMPLATES_WRITE);
}

export function canWriteAnalytics(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.ANALYTICS_WRITE);
}

export function canImportData(role?: SessionRole | null): boolean {
  if (!IMPORT_ENABLED) return false;
  return hasScope(role, PERMISSIONS.IMPORT_WRITE);
}

export function canEditFeedbackStatus(role?: SessionRole | null): boolean {
  return hasAnyScope(role, [
    PERMISSIONS.FEEDBACK_STATUS,
    PERMISSIONS.FEEDBACK_WRITE,
  ]);
}

export function canEditFeedbackFully(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.FEEDBACK_WRITE);
}

/** Feedback date is set by QA/QM when sharing — not editable by agents. */
export function canEditFeedbackDate(role?: SessionRole | null): boolean {
  return canEditFeedbackFully(role);
}

/** Supervisor (and QM) remarks on viewed audits. */
export function canEditSupervisorRemarks(role?: SessionRole | null): boolean {
  if (!role) return false;
  if (isSuperAdmin(role)) return true;
  return (
    role.slug === SYSTEM_ROLE_SLUGS.SUPERVISOR ||
    role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  );
}

export function canReadFeedback(role?: SessionRole | null): boolean {
  return hasAnyScope(role, [
    PERMISSIONS.FEEDBACK_READ,
    PERMISSIONS.FEEDBACK_STATUS,
    PERMISSIONS.FEEDBACK_WRITE,
  ]);
}

/** @deprecated Use canManageUsers — kept for gradual migration */
export function canAccessAdmin(role?: SessionRole | null): boolean {
  return canManageUsers(role);
}
