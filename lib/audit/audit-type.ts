/** Static audit classification options (Interaction Details). */

export const AUDIT_TYPE_OPTIONS = [
  "BAU Audit",
  "Certification Audit",
  "New Agent Audit",
  "Calibration Audit",
] as const;

export type AuditType = (typeof AUDIT_TYPE_OPTIONS)[number];

export function isAuditType(value: string): value is AuditType {
  return (AUDIT_TYPE_OPTIONS as readonly string[]).includes(value);
}

/** Normalize sheet/API values to a known option, or empty when unknown/blank. */
export function parseAuditType(value: unknown): AuditType | "" {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const exact = AUDIT_TYPE_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  const compact = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  const aliases: Record<string, AuditType> = {
    bau: "BAU Audit",
    bauaudit: "BAU Audit",
    certification: "Certification Audit",
    certificationaudit: "Certification Audit",
    newagent: "New Agent Audit",
    newagentaudit: "New Agent Audit",
    calibration: "Calibration Audit",
    calibrationaudit: "Calibration Audit",
  };
  return aliases[compact] ?? "";
}
