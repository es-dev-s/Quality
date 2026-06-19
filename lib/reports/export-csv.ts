import type { ReportRow } from "@/lib/actions/reports";
import type { AuditRow } from "@/lib/audit/types";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function formatParameterDetail(rows: AuditRow[]): string {
  return rows
    .map((row) => {
      const fatal = row.fatal ? " [FATAL]" : "";
      return `${row.cat} | ${row.name} | ${row.sel} | ${row.score}/${row.max}${fatal}`;
    })
    .join("\n");
}

/** Full audit export — one row per submission with all form fields and parameter breakdown. */
export function exportReportCsv(rows: ReportRow[], filenamePrefix = "quality-report") {
  const headers = [
    "Audit ID",
    "Agent",
    "Supervisor",
    "Quality analyst",
    "Interaction type",
    "Business type",
    "LOB",
    "Sub-LOB",
    "Reason",
    "Sub-reason",
    "Call date",
    "Audit date",
    "Mobile",
    "Reference URL",
    "Response",
    "Quality %",
    "Final %",
    "Grade",
    "Has fatal",
    "Fatal parameters",
    "Points scored",
    "Points max",
    "Feedback security",
    "Feedback status",
    "Feedback date",
    "Acknowledged / disputed at",
    "Feedback for agent",
    "Supervisor remarks",
    "Submitted by",
    "Submitted at",
    "Parameter breakdown",
  ];

  const lines = rows.map((r) =>
    [
      r.auditCode,
      r.agent,
      r.supervisor ?? "",
      r.auditor ?? "",
      r.type,
      r.businessType,
      r.lob,
      r.sublob ?? "",
      r.reason ?? "",
      r.subReason ?? "",
      r.callDate,
      r.auditDate,
      r.mobile ?? "",
      r.referenceUrl ?? "",
      r.response ?? "",
      r.qualityPct,
      r.hasFatal ? 0 : r.finalPct,
      r.grade,
      r.hasFatal ? "Yes" : "No",
      r.fatalList.join("; "),
      r.totalScored,
      r.totalMax,
      r.feedbackSecurity,
      r.feedbackStatus,
      r.feedbackDate ?? "",
      formatDateTime(r.feedbackStatusAt),
      r.agentFeedback,
      r.supervisorRemarks,
      r.submittedBy,
      r.createdAt,
      formatParameterDetail(r.rows),
    ]
      .map(csvCell)
      .join(",")
  );

  const blob = new Blob([[headers.map(csvCell).join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
