"use client";

import { cn } from "@/lib/utils";
import {
  auditSourceLabel,
  type AuditSourceKind,
} from "@/lib/audit/audit-source";

const TITLE_BY_SOURCE: Record<AuditSourceKind, string> = {
  supervisor: "Submitted by a Supervisor — available for QA verification",
  qa: "Submitted by a Quality Analyst",
  other: "Submitted by Admin / Quality Manager / other role",
};

export function AuditSourceBadge({
  source,
  className,
}: {
  source: AuditSourceKind;
  className?: string;
}) {
  if (source === "other") return null;

  return (
    <span
      className={cn(
        "audit-source-badge",
        source === "supervisor" && "audit-source-badge--supervisor",
        source === "qa" && "audit-source-badge--qa",
        className
      )}
      title={TITLE_BY_SOURCE[source]}
    >
      {auditSourceLabel(source)}
    </span>
  );
}
