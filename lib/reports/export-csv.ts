import { FEEDBACK_SEVERITY_LABEL } from "@/lib/audit/feedback";
import {
  collectParameterColumnKeys,
  formatCategoryScores,
  parameterCellValue,
  parameterColumnKey,
  type AuditExportRow,
} from "@/lib/reports/audit-export-row";

/** @deprecated Use AuditExportRow */
export type { AuditExportRow as ReportRow } from "@/lib/reports/audit-export-row";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function formatParameterSummary(rows: AuditExportRow["rows"]): string {
  return rows
    .map((row) => {
      const fatal = row.fatal ? " [FATAL]" : "";
      return `${row.cat} | ${row.name} | ${row.sel} | ${row.score}/${row.max}${fatal}`;
    })
    .join("; ");
}

const FIXED_HEADERS = [
  "Audit ID",
  "Template",
  "Agent",
  "Supervisor",
  "Quality analyst",
  "Interaction type",
  "Business type",
  "LOB",
  "Sub-LOB",
  "Reason",
  "Sub-reason (DFF)",
  "Call date",
  "Audit date",
  "Contact (number / name)",
  "Reference",
  "Response",
  "Quality %",
  "Final %",
  "Grade",
  "Has fatal",
  "Fatal parameters",
  "Points scored",
  "Points max",
  "Category scores",
  "Parameter summary",
  FEEDBACK_SEVERITY_LABEL,
  "Feedback status",
  "Feedback date",
  "Acknowledged / disputed at",
  "Feedback for agent",
  "Supervisor remarks",
  "Submitted by",
  "Submitted at",
] as const;

function buildFixedRowValues(row: AuditExportRow): unknown[] {
  return [
    row.auditCode,
    row.templateName ?? "",
    row.agent,
    row.supervisor ?? "",
    row.auditor ?? "",
    row.type,
    row.businessType,
    row.lob,
    row.sublob ?? "",
    row.reason ?? "",
    row.subReason ?? "",
    row.callDate,
    row.auditDate,
    row.mobile ?? "",
    row.referenceUrl ?? "",
    row.response ?? "",
    row.qualityPct,
    row.hasFatal ? 0 : row.finalPct,
    row.grade,
    row.hasFatal ? "Yes" : "No",
    row.fatalList.join("; "),
    row.totalScored,
    row.totalMax,
    formatCategoryScores(row.catScores),
    formatParameterSummary(row.rows),
    row.feedbackSecurity,
    row.feedbackStatus,
    row.feedbackDate ?? "",
    formatDateTime(row.feedbackStatusAt),
    row.agentFeedback,
    row.supervisorRemarks,
    row.submittedBy,
    row.createdAt,
  ];
}

/** Build CSV text — one row per audit with full form fields and per-parameter columns. */
export function buildAuditExportCsv(rows: AuditExportRow[]): string {
  const parameterHeaders = collectParameterColumnKeys(rows);
  const headers = [...FIXED_HEADERS, ...parameterHeaders];

  const lines = rows.map((row) => {
    const parameterValues = new Map<string, string>();
    for (const param of row.rows) {
      parameterValues.set(parameterColumnKey(param), parameterCellValue(param));
    }

    const values = buildFixedRowValues(row);
    const paramCells = parameterHeaders.map(
      (header) => parameterValues.get(header) ?? ""
    );

    return [...values, ...paramCells]
      .map(csvCell)
      .join(",");
  });

  return `\uFEFF${[headers.map(csvCell).join(","), ...lines].join("\n")}`;
}

/** Download full audit export — one row per submission with all form and rubric details. */
export function exportReportCsv(
  rows: AuditExportRow[],
  filenamePrefix = "quality-report"
) {
  if (rows.length === 0) return;

  const blob = new Blob([buildAuditExportCsv(rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
