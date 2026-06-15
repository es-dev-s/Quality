"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Pencil, X } from "lucide-react";
import { getAuditDetail, updateSupervisorRemarks } from "@/lib/actions/audit";
import type { AuditDetail } from "@/lib/audit/audit-records";
import type { AuditRow } from "@/lib/audit/types";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";
import { cn } from "@/lib/utils";

type AuditDetailModalProps = {
  auditId: string | null;
  canEditAudits?: boolean;
  canEditSupervisorRemarks?: boolean;
  onClose: () => void;
};

function gradeClass(grade: string) {
  if (grade === "Failed") return "dash-grade dash-grade--failed";
  if (grade === "Excellent") return "dash-grade dash-grade--excellent";
  if (grade === "Good") return "dash-grade dash-grade--good";
  return "dash-grade dash-grade--needs";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function groupRowsByCategory(rows: AuditRow[]): Map<string, AuditRow[]> {
  const grouped = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.cat) ?? [];
    list.push(row);
    grouped.set(row.cat, list);
  }
  return grouped;
}

export function AuditDetailModal({
  auditId,
  canEditAudits = false,
  canEditSupervisorRemarks = false,
  onClose,
}: AuditDetailModalProps) {
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [remarksMessage, setRemarksMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [remarksPending, startRemarks] = useTransition();
  const { beginRequest } = useStaleRequestGuard();

  useEffect(() => {
    if (!auditId) {
      setDetail(null);
      setError(null);
      setRemarksDraft("");
      setRemarksMessage(null);
      return;
    }

    const request = beginRequest();
    startTransition(async () => {
      try {
        const data = await getAuditDetail(auditId);
        if (request.isStale()) return;
        if (!data) {
          setError("Audit not found.");
          setDetail(null);
          return;
        }
        setDetail(data);
        setRemarksDraft(data.supervisorRemarks ?? "");
        setError(null);
      } catch {
        if (request.isStale()) return;
        setError("Unable to load audit details.");
        setDetail(null);
      }
    });
  }, [auditId, beginRequest]);

  const rowsByCategory = useMemo(
    () => (detail ? groupRowsByCategory(detail.rows) : new Map()),
    [detail]
  );

  function saveRemarks() {
    if (!detail) return;
    startRemarks(async () => {
      setRemarksMessage(null);
      const result = await updateSupervisorRemarks(detail.id, remarksDraft);
      if ("error" in result && result.error) {
        setRemarksMessage(result.error);
        return;
      }
      setDetail({ ...detail, supervisorRemarks: remarksDraft });
      setRemarksMessage("Remarks saved.");
    });
  }

  if (!auditId) return null;

  return (
    <div className="platform-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="platform-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="platform-modal__panel platform-modal__panel--wide">
        <header className="platform-modal__head">
          <div>
            <h2 className="platform-modal__title">Audit details</h2>
            <p className="platform-modal__sub">
              {detail?.auditCode ?? "Loading…"}
            </p>
          </div>
          <div className="platform-modal__head-actions">
            {detail && canEditAudits ? (
              <Link
                href={`/audit-logs/${detail.id}/edit`}
                className="ui-btn ui-btn--secondary ui-btn--sm"
                onClick={onClose}
              >
                <Pencil size={15} aria-hidden />
                Edit
              </Link>
            ) : null}
            <button
              type="button"
              className="platform-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="platform-modal__body">
          {isPending && !detail && !error && (
            <p className="platform-empty">Loading audit…</p>
          )}
          {error && (
            <p className="platform-empty platform-empty--error">{error}</p>
          )}
          {detail && (
            <div className="audit-detail">
              <div className="audit-detail__scores">
                <div className="audit-detail__score-card">
                  <span className="audit-detail__score-label">Quality</span>
                  <strong className="audit-detail__score-value">
                    {detail.qualityPct}%
                  </strong>
                </div>
                <div className="audit-detail__score-card">
                  <span className="audit-detail__score-label">Final</span>
                  <strong
                    className={
                      detail.hasFatal
                        ? "audit-detail__score-value audit-detail__score-value--danger"
                        : "audit-detail__score-value"
                    }
                  >
                    {detail.hasFatal ? "FAILED" : `${detail.finalPct}%`}
                  </strong>
                </div>
                <div className="audit-detail__score-card">
                  <span className="audit-detail__score-label">Grade</span>
                  <span className={gradeClass(detail.grade)}>{detail.grade}</span>
                </div>
                <div className="audit-detail__score-card">
                  <span className="audit-detail__score-label">Points</span>
                  <strong className="audit-detail__score-value">
                    {detail.totalScored}/{detail.totalMax}
                  </strong>
                </div>
              </div>

              <h3 className="audit-detail__section-title">Interaction details</h3>
              <div className="audit-detail__grid">
                <div>
                  <span className="audit-detail__field-label">Agent</span>
                  <p>{detail.agent}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Supervisor</span>
                  <p>{detail.supervisor ?? "—"}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Quality analyst</span>
                  <p>{detail.auditor ?? "—"}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Type</span>
                  <p>
                    {detail.type} · {detail.businessType}
                  </p>
                </div>
                <div>
                  <span className="audit-detail__field-label">LOB</span>
                  <p>
                    {detail.lob}
                    {detail.sublob ? ` / ${detail.sublob}` : ""}
                  </p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Call date</span>
                  <p>{detail.callDate}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Audit date</span>
                  <p>{detail.auditDate}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Reason</span>
                  <p>{detail.reason ?? "—"}</p>
                </div>
                {detail.subReason ? (
                  <div>
                    <span className="audit-detail__field-label">Sub-reason / DFF</span>
                    <p>{detail.subReason}</p>
                  </div>
                ) : null}
                {detail.mobile ? (
                  <div>
                    <span className="audit-detail__field-label">
                      {detail.type === "Call" ? "Mobile" : "Reference"}
                    </span>
                    <p>{detail.mobile}</p>
                  </div>
                ) : null}
                {detail.response ? (
                  <div className="audit-detail__grid-span">
                    <span className="audit-detail__field-label">Response</span>
                    <p>{detail.response}</p>
                  </div>
                ) : null}
                <div>
                  <span className="audit-detail__field-label">Submitted by</span>
                  <p>{detail.submittedBy}</p>
                </div>
                <div>
                  <span className="audit-detail__field-label">Submitted at</span>
                  <p>{formatDateTime(detail.createdAt)}</p>
                </div>
              </div>

              <div className="audit-detail__feedback">
                <h3 className="audit-detail__section-title">Feedback</h3>
                <div className="audit-detail__grid">
                  <div>
                    <span className="audit-detail__field-label">Security</span>
                    <p>{detail.feedbackSecurity}</p>
                  </div>
                  <div>
                    <span className="audit-detail__field-label">Feedback status</span>
                    <p>{detail.feedbackStatus}</p>
                  </div>
                  <div>
                    <span className="audit-detail__field-label">Feedback date</span>
                    <p>{detail.feedbackDate ?? "—"}</p>
                  </div>
                  {(detail.feedbackStatus === "Acknowledged" ||
                    detail.feedbackStatus === "Disputed") && (
                    <div>
                      <span className="audit-detail__field-label">
                        {detail.feedbackStatus === "Acknowledged"
                          ? "Acknowledged at"
                          : "Disputed at"}
                      </span>
                      <p>{formatDateTime(detail.feedbackStatusAt)}</p>
                    </div>
                  )}
                </div>
                <div className="audit-detail__agent-feedback">
                  <span className="audit-detail__field-label">
                    Feedback for the agent
                  </span>
                  <p>{detail.agentFeedback.trim() || "—"}</p>
                </div>
              </div>

              {(canEditSupervisorRemarks || detail.supervisorRemarks.trim()) && (
                <div className="audit-detail__remarks">
                  <h3 className="audit-detail__section-title">
                    Supervisor remarks
                  </h3>
                  {canEditSupervisorRemarks ? (
                    <>
                      <textarea
                        className="audit-detail__remarks-input"
                        rows={4}
                        value={remarksDraft}
                        onChange={(e) => setRemarksDraft(e.target.value)}
                        placeholder="Add feedback or remarks for this audit…"
                      />
                      <div className="audit-detail__remarks-actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn--primary ui-btn--sm"
                          disabled={remarksPending}
                          onClick={saveRemarks}
                        >
                          {remarksPending ? "Saving…" : "Save remarks"}
                        </button>
                        {remarksMessage ? (
                          <span
                            className={cn(
                              "audit-detail__remarks-msg",
                              remarksMessage.endsWith(".") &&
                                !remarksMessage.includes("error") &&
                                "audit-detail__remarks-msg--ok"
                            )}
                          >
                            {remarksMessage}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="audit-detail__remarks-text">
                      {detail.supervisorRemarks.trim() || "—"}
                    </p>
                  )}
                </div>
              )}

              {detail.hasFatal && detail.fatalList.length > 0 && (
                <div className="audit-detail__fatals">
                  <h3 className="audit-detail__section-title">Fatal parameters</h3>
                  <div className="audit-detail__fatal-list">
                    {detail.fatalList.map((item) => (
                      <span key={item} className="audit-detail__fatal-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(detail.catScores).length > 0 && (
                <div className="audit-detail__categories">
                  <h3 className="audit-detail__section-title">Category scores</h3>
                  <div className="audit-detail__cat-accordion">
                    {Object.entries(detail.catScores).map(([name, cat]) => {
                      const pct =
                        cat.max > 0
                          ? Math.round((cat.scored / cat.max) * 100)
                          : 0;
                      const params = rowsByCategory.get(name) ?? [];
                      return (
                        <details key={name} className="audit-detail__cat-block">
                          <summary className="audit-detail__cat-summary">
                            <span>{name}</span>
                            <strong>
                              {cat.scored}/{cat.max} ({pct}%)
                            </strong>
                            <ChevronDown
                              size={16}
                              className="audit-detail__cat-chevron"
                              aria-hidden
                            />
                          </summary>
                          {params.length > 0 ? (
                            <ul className="audit-detail__param-list">
                              {params.map((row: AuditRow) => (
                                <li key={row.id} className="audit-detail__param-row">
                                  <span>{row.name}</span>
                                  <span
                                    className={cn(
                                      row.fatal && "audit-detail__param-fatal"
                                    )}
                                  >
                                    {row.sel} · {row.score}/{row.max}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="audit-detail__param-empty">
                              No parameter breakdown stored.
                            </p>
                          )}
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}

              {detail.rows.length > 0 && (
                <div className="audit-detail__parameters">
                  <h3 className="audit-detail__section-title">
                    Parameter scores
                  </h3>
                  <div className="ui-table-wrap">
                    <table className="ui-table audit-detail__param-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Parameter</th>
                          <th>Selection</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.cat}</td>
                            <td>{row.name}</td>
                            <td
                              className={cn(
                                row.fatal && "audit-detail__param-fatal"
                              )}
                            >
                              {row.sel}
                            </td>
                            <td>
                              {row.score}/{row.max}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
