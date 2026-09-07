import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

/** QA displays the Quality Manager's target, not a personal QA target. */
export function resolveDisplayedAuditTargetOwnerId(params: {
  viewerUserId: string;
  viewerRoleSlug: string;
  createdById?: string | null;
  createdByRoleSlug?: string | null;
  managerCreatedById?: string | null;
  managerCreatedByRoleSlug?: string | null;
}): string {
  if (params.viewerRoleSlug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
    return params.viewerUserId;
  }

  if (
    params.createdById &&
    params.createdByRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  ) {
    return params.createdById;
  }

  if (
    params.managerCreatedById &&
    params.managerCreatedByRoleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
  ) {
    return params.managerCreatedById;
  }

  return params.viewerUserId;
}
