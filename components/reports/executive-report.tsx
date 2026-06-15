"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar, Download, Printer } from "lucide-react";
import { getReportData, type ReportPageData } from "@/lib/actions/reports";
import { PASS_RATE_TARGET_PCT } from "@/lib/audit/metrics-config";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function gradeClass(grade: string) {
  if (grade === "Failed") return "dash-grade dash-grade--failed";
  if (grade === "Excellent") return "dash-grade dash-grade--excellent";
  if (grade === "Good") return "dash-grade dash-grade--good";
  return "dash-grade dash-grade--needs";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function exportCsv(rows: ReportPageData["rows"]) {
  const headers = [
    "Audit ID",
    "Agent",
    "Supervisor",
    "Auditor",
    "Type",
    "Business Type",
    "Call Date",
    "Audit Date",
    "LOB",
    "Sub-LOB",
    "Reason",
    "Sub-reason",
    "Mobile",
    "Response",
    "Quality %",
    "Final %",
    "Grade",
    "Has Fatal",
    "Fatal Parameters",
    "Points Scored",
    "Points Max",
    "Feedback Security",
    "Feedback Status",
    "Feedback Date",
    "Acknowledged/Disputed At",
    "Agent Feedback",
    "Supervisor Remarks",
    "Submitted By",
    "Submitted At",
    "Parameter Scores",
  ];
  const lines = rows.map((r) =>
    [
      r.auditCode,
      r.agent,
      r.supervisor ?? "",
      r.auditor ?? "",
      r.type,
      r.businessType,
      r.callDate,
      r.auditDate,
      r.lob,
      r.sublob ?? "",
      r.reason ?? "",
      r.subReason ?? "",
      r.mobile ?? "",
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
      r.parameterSummary,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quality-report-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExecutiveReport() {
  const initial = defaultRange();
  const [range, setRange] = useState(initial);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [data, setData] = useState<ReportPageData | null>(null);
  const [isPending, startTransition] = useTransition();
  const { beginRequest } = useStaleRequestGuard();

  function load(start: string, end: string) {
    const request = beginRequest();
    startTransition(async () => {
      const result = await getReportData(start, end);
      if (request.isStale()) return;
      setData(result);
    });
  }

  useEffect(() => {
    load(appliedRange.start, appliedRange.end);
  }, [appliedRange.start, appliedRange.end]);

  function handleApply() {
    setAppliedRange(range);
  }

  return (
    <div className="platform-report" id="executive-report">
      <div className="platform-report__toolbar">
        <div className="platform-report__dates">
          <label className="platform-report__date-field">
            <span>Start date (audit)</span>
            <div className="platform-report__date-input">
              <Calendar size={15} aria-hidden />
              <input
                type="date"
                value={range.start}
                onChange={(e) =>
                  setRange((r) => ({ ...r, start: e.target.value }))
                }
              />
            </div>
          </label>
          <label className="platform-report__date-field">
            <span>End date (audit)</span>
            <div className="platform-report__date-input">
              <Calendar size={15} aria-hidden />
              <input
                type="date"
                value={range.end}
                onChange={(e) =>
                  setRange((r) => ({ ...r, end: e.target.value }))
                }
              />
            </div>
          </label>
          <button
            type="button"
            className="ui-btn ui-btn--primary ui-btn--sm"
            onClick={handleApply}
            disabled={isPending}
          >
            Apply range
          </button>
        </div>
        <div className="platform-report__actions">
          <button
            type="button"
            className="ui-btn ui-btn--secondary ui-btn--sm"
            onClick={() => window.print()}
            disabled={!data?.rows.length}
          >
            <Printer size={15} aria-hidden />
            Print
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary ui-btn--sm"
            onClick={() => data && exportCsv(data.rows)}
            disabled={!data?.rows.length}
          >
            <Download size={15} aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      {isPending && !data && (
        <p className="platform-empty">Generating report…</p>
      )}

      {data && data.stats.total === 0 && (
        <p className="platform-empty">
          No audits found between {data.startDate} and {data.endDate} (by audit
          date).
        </p>
      )}

      {data && data.stats.total > 0 && (
        <>
          <div className="platform-kpi-row">
            <article className="platform-kpi">
              <p className="platform-kpi__label">Total audits</p>
              <p className="platform-kpi__value">{data.stats.total}</p>
            </article>
            <article className="platform-kpi">
              <p className="platform-kpi__label">Avg quality</p>
              <p className="platform-kpi__value platform-kpi__value--accent">
                {data.stats.avgQuality}%
              </p>
            </article>
            <article className="platform-kpi">
              <p className="platform-kpi__label">Pass rate</p>
              <p className="platform-kpi__value platform-kpi__value--success">
                {data.stats.passRate}%
              </p>
              <p className="platform-kpi__hint">
                target ≥{PASS_RATE_TARGET_PCT}%
              </p>
            </article>
            <article className="platform-kpi">
              <p className="platform-kpi__label">Fatal audits</p>
              <p className="platform-kpi__value platform-kpi__value--danger">
                {data.stats.fatals}
              </p>
            </article>
          </div>

          <div className="ui-table-wrap platform-table-wrap">
            <table className="ui-table platform-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Auditor</th>
                  <th>Audit date</th>
                  <th>Type</th>
                  <th>LOB</th>
                  <th>Quality</th>
                  <th>Final</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="platform-cell-strong">{row.agent}</td>
                    <td>{row.auditor ?? "—"}</td>
                    <td>{row.auditDate}</td>
                    <td>
                      {row.type}
                      <span className="dash-cell-muted"> · {row.businessType}</span>
                    </td>
                    <td>{row.lob}</td>
                    <td className="platform-cell-accent">{row.qualityPct}%</td>
                    <td>
                      {row.hasFatal ? (
                        <span className="platform-cell-danger">FAILED</span>
                      ) : (
                        `${row.finalPct}%`
                      )}
                    </td>
                    <td>
                      <span className={gradeClass(row.grade)}>{row.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
