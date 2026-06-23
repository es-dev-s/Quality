import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  AccountDeactivatedError,
  AccountNotApprovedError,
  SessionRevokedError,
} from "@/lib/auth-errors";
import { redirectForInvalidSession } from "@/lib/auth-redirects";
import type { InvalidSessionReason } from "@/lib/auth-redirects";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { canAccessPath, firstAccessiblePath, hasScope } from "@/lib/rbac";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isInvalidSessionError(error: unknown): boolean {
  return (
    error instanceof AccountDeactivatedError ||
    error instanceof AccountNotApprovedError ||
    error instanceof SessionRevokedError
  );
}

export function invalidSessionRedirectReason(error: unknown): InvalidSessionReason {
  if (error instanceof AccountDeactivatedError) {
    return "deactivated";
  }
  if (error instanceof AccountNotApprovedError) {
    return "not_approved";
  }
  return "session";
}

export async function requirePermission(permission: Permission) {
  const session = await requireAuth();
  if (!hasScope(session.user.role, permission)) {
    throw new ForbiddenError();
  }
  return session;
}

export async function requirePageAccess(pathname: string) {
  let session;
  try {
    session = await requireAuth();
  } catch (error) {
    if (isInvalidSessionError(error)) {
      redirectForInvalidSession(pathname, invalidSessionRedirectReason(error));
    }
    throw error;
  }

  if (canAccessPath(session.user.role, pathname)) {
    return session;
  }

  const fallback = firstAccessiblePath(session.user.role);
  if (fallback && fallback !== pathname) {
    redirect(fallback);
  }

  redirect("/access-denied");
}

export async function requireAnyPermission(permissions: Permission[]) {
  const session = await requireAuth();
  if (!permissions.some((permission) => hasScope(session.user.role, permission))) {
    throw new ForbiddenError();
  }
  return session;
}

export function permissionError() {
  return { error: "You do not have permission to perform this action." as const };
}

/** Like requirePermission but returns a client-friendly error instead of throwing. */
export async function requirePermissionResult(permission: Permission) {
  const session = await requireAuth();
  if (!hasScope(session.user.role, permission)) {
    return { error: permissionError().error, session: null as null };
  }
  return { error: null as null, session };
}

export { PERMISSIONS };
