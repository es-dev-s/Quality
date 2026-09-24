import type { Prisma } from "@prisma/client";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import {
  isSupervisorRoleSlug,
  SUPERVISOR_TIER_ROLE_SLUG_FILTER,
} from "@/lib/audit/supervisor-tier";

/** Who submitted the audit form — used for QA verification tagging. */
export type AuditSourceKind = "supervisor" | "qa" | "other";

export type AuditSourceFilterValue = AuditSourceKind | "";

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

/** Shared sidebar options — matches Audit Logs. */
export const AUDIT_SOURCE_FILTER_OPTIONS: {
  value: AuditSourceFilterValue;
  label: string;
}[] = [
  { value: "", label: auditSourceFilterLabel("all") },
  { value: "supervisor", label: "Supervisor audits" },
  { value: "qa", label: "QA audits" },
  { value: "other", label: "Other sources" },
];

export function auditSourceChipLabel(source: AuditSourceKind): string {
  if (source === "supervisor") return "Source: Supervisor";
  if (source === "qa") return "Source: QA";
  return "Source: Other";
}

/** Prisma clause for Reports (and any DB-scoped filter). */
export function auditSourceWhere(
  source: AuditSourceFilterValue
): Prisma.AuditSubmissionWhereInput | undefined {
  if (!source) return undefined;
  if (source === "supervisor") {
    return {
      submittedBy: { role: { slug: SUPERVISOR_TIER_ROLE_SLUG_FILTER } },
    };
  }
  if (source === "qa") {
    return {
      submittedBy: { role: { slug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST } },
    };
  }
  return {
    NOT: {
      submittedBy: {
        role: {
          slug: {
            in: [
              ...SUPERVISOR_TIER_ROLE_SLUG_FILTER.in,
              SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
            ],
          },
        },
      },
    },
  };
}
