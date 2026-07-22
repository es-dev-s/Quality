import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { isSupervisorRoleSlug } from "@/lib/audit/supervisor-tier";

/** Who submitted the audit form — used for QA verification tagging. */
export type AuditSourceKind = "supervisor" | "qa" | "other";

export function resolveAuditSourceKind(
  roleSlug: string | null | undefined
): AuditSourceKind {
  if (isSupervisorRoleSlug(roleSlug)) return "supervisor";
  if (roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) return "qa";
  return "other";
}

export function auditSourceLabel(kind: AuditSourceKind): string {
  switch (kind) {
    case "supervisor":
      return "Supervisor";
    case "qa":
      return "QA";
    default:
      return "Other";
  }
}

export function auditSourceFilterLabel(kind: AuditSourceKind | "all"): string {
  if (kind === "all") return "All sources";
  return auditSourceLabel(kind);
}
