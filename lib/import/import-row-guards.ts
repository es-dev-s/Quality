import type { ParsedAuditImportRow } from "@/lib/import/audit-import-types";

const SERIAL_HEADER_RE =
  /^(s\.?n\.?|sno|serial(?:\s*no\.?)?|#|row|column\d*)$/i;

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/\r\n|\n|\r/g, " ")
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "")
    .replace(/[\s_-]+/g, "")
    .replace(/[()/<%.>]+/g, "");
}

/** Headers that alone never make a row importable (serial / junk). */
export function isIgnorableImportHeader(header: string): boolean {
  const key = normalizeHeaderKey(header);
  if (!key) return true;
  return (
    SERIAL_HEADER_RE.test(header.trim()) ||
    key === "sn" ||
    key === "sno" ||
    key === "serial" ||
    key === "serialno" ||
    key === "row" ||
    /^column\d*$/.test(key)
  );
}

/**
 * Fully blank / serial-only sheet rows must be ignored — never validated
 * or written to the database.
 */
export function isBlankAuditSheetRow(
  record: Record<string, string>
): boolean {
  for (const [header, value] of Object.entries(record)) {
    if (!String(value ?? "").trim()) continue;
    if (isIgnorableImportHeader(header)) continue;
    return false;
  }
  return true;
}

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Server/client integrity gate — blocks incomplete or fabricated rows
 * from reaching Prisma.
 */
export function importRowIntegrityError(
  row: ParsedAuditImportRow
): string | null {
  if (row.errors.length > 0) {
    return row.errors.join(" ");
  }

  const agent = row.formData.agent.trim();
  const auditor = row.formData.auditor.trim();
  if (!agent) return "Agent Name is required.";
  if (!auditor) return "Quality Auditor is required.";

  if (!row.formData.callDate.trim() && !row.formData.auditDate.trim()) {
    return "Audit date or call date is required.";
  }

  if (!row.templateId?.trim()) {
    return "Could not match an audit template for this row.";
  }

  if (!row.auditCode.trim()) {
    return "Audit ID is required.";
  }

  const hasMappedScores = Object.keys(row.scores).some(
    (key) => String(row.scores[key] ?? "").trim().length > 0
  );
  const hasAuditRows = row.auditRows.some((entry) => entry.sel.trim().length > 0);
  const hasTotals = row.totalMax > 0;
  const hasGrade = row.grade.trim().length > 0;
  // Historical sheets may only include overall % (no param columns).
  const hasAggregateScore =
    hasGrade &&
    Number.isFinite(row.qualityPct) &&
    Number.isFinite(row.finalPct);

  if (!hasMappedScores && !hasAuditRows && !hasTotals && !hasAggregateScore) {
    return "Missing scoring data — add parameter columns or an overall score.";
  }

  if (!hasGrade) {
    return "Grade is required when importing scored audits.";
  }

  if (!isFinitePercent(row.qualityPct)) {
    return "Overall score must be a number between 0 and 100.";
  }
  if (!isFinitePercent(row.finalPct)) {
    return "Final % must be a number between 0 and 100.";
  }
  if (!isFiniteNonNegative(row.totalScored) || !isFiniteNonNegative(row.totalMax)) {
    return "Points scored / max must be valid numbers.";
  }
  if (row.totalMax > 0 && row.totalScored > row.totalMax + 0.001) {
    return "Points scored cannot exceed points max.";
  }

  return null;
}
