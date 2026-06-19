"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar, Download, Printer } from "lucide-react";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { getReportData, type ReportPageData } from "@/lib/actions/reports";
import { PASS_RATE_TARGET_PCT } from "@/lib/audit/metrics-config";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";
import { exportReportCsv } from "@/lib/reports/export-csv";

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

export function ExecutiveReport({ canExport = false }: { canExport?: boolean }) {
  const initial = defaultRange();
  const [range, setRange] = useState(initial);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [data, setData] = useState<ReportPageData | null>(null);
  const [isPending, startTransition] = useTransition();
  const { beginRequest } = useStaleRequestGuard();

  const pagination = usePaginatedRows(data?.rows ?? []);

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

  function handleExport() {
    if (!data?.rows.length) return;
    exportReportCsv(data.rows);
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
          {canExport ? (
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--sm"
              onClick={handleExport}
              disabled={!data?.rows.length}
            >
              <Download size={15} aria-hidden />
              Export CSV ({data?.rows.length ?? 0})
            </button>
          ) : null}
        </div>
      </div>

      <LoadingZone
        loading={isPending}
        label={data ? "Refreshing report…" : "Loading report…"}
        className="loading-zone--min"
      >
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

          <DataTablePanel
            pagination={pagination}
            renderTable={(slice) => (
              <table className="ui-table platform-table platform-report-table">
                <thead>
                  <tr>
                    <th>Audit ID</th>
                    <th>Agent</th>
                    <th>Supervisor</th>
                    <th>Auditor</th>
                    <th>Audit date</th>
                    <th>Call date</th>
                    <th>Type</th>
                    <th>LOB</th>
                    <th>Reason</th>
                    <th>Quality</th>
                    <th>Final</th>
                    <th>Grade</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => (
                    <tr key={row.id}>
                      <td className="platform-report-table__code">{row.auditCode}</td>
                      <td className="platform-cell-strong">{row.agent}</td>
                      <td>{row.supervisor ?? "—"}</td>
                      <td>{row.auditor ?? "—"}</td>
                      <td>{row.auditDate}</td>
                      <td>{row.callDate}</td>
                      <td>
                        {row.type}
                        <span className="dash-cell-muted"> · {row.businessType}</span>
                      </td>
                      <td>
                        {row.lob}
                        {row.sublob ? (
                          <span className="dash-cell-muted"> / {row.sublob}</span>
                        ) : null}
                      </td>
                      <td className="platform-report-table__reason">
                        {row.reason ?? "—"}
                      </td>
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
                      <td>{row.feedbackStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        </>
      )}
      </LoadingZone>
    </div>
  );
}
