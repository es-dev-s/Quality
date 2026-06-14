import { SUPERADMIN_ROLE_SLUG } from "@/lib/constants";
import {
  PERMISSIONS,
  resolveRoutePermission,
  ROUTE_PERMISSIONS,
  type Permission,
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
  return role.scopes.includes(permission);
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

export function canReadAuditLogs(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_LOGS_READ);
}

export function canWriteAuditTemplates(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.AUDIT_TEMPLATES_WRITE);
}

export function canWriteAnalytics(role?: SessionRole | null): boolean {
  return hasScope(role, PERMISSIONS.ANALYTICS_WRITE);
}

export function canImportData(role?: SessionRole | null): boolean {
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
