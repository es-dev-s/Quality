"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileText, MessageSquare, Pencil, Phone, ShieldAlert, X } from "lucide-react";
import { getAuditDetail, updateSupervisorRemarks } from "@/lib/actions/audit";
import { ReferenceAttachmentView } from "@/components/audit-logs/reference-attachment-view";
import {
  detectReferenceAttachmentKind,
  normalizeUploadedReferencePath,
} from "@/lib/upload/reference-url-paths";
import type { AuditDetail } from "@/lib/audit/audit-records";
import { interactionContactFieldLabel, interactionReferenceSectionLabel } from "@/lib/audit/interaction-labels";
import type { AuditRow } from "@/lib/audit/types";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";
import { FEEDBACK_SEVERITY_LABEL } from "@/lib/audit/feedback";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";
import { LoadingIndicator, LoadingZone } from "@/components/primitives/loading-zone";
import { cn } from "@/lib/utils";

type AuditDetailModalProps = {
  auditId: string | null;
  canEditAudits?: boolean;
  canEditSupervisorRemarks?: boolean;
  onClose: () => void;
  /** Render above another open modal (e.g. fatal occurrences list) */
  elevated?: boolean;
};

function gradeClass(grade: string) {
  if (grade === "Failed") return "adi-grade adi-grade--failed";
  if (grade === "Excellent") return "adi-grade adi-grade--excellent";
  if (grade === "Good") return "adi-grade adi-grade--good";
  return "adi-grade adi-grade--needs";
}

function scoreToneClass(pct: number) {
  if (pct >= 90) return "adi-kpi__val--success";
  if (pct >= 75) return "adi-kpi__val--warn";
  return "adi-kpi__val--danger";
}

function formatDateTime(value: string | null | undefined): string {
  return formatFeedbackDateTime(value);
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

/** Label + value field used in info grids */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="adi-field">
      <span className="adi-field__label">{label}</span>
      <div className="adi-field__val">{children}</div>
    </div>
  );
}

export function AuditDetailModal({
  auditId,
  canEditAudits = false,
  canEditSupervisorRemarks = false,
  onClose,
  elevated = false,
}: AuditDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [remarksMessage, setRemarksMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [remarksPending, startRemarks] = useTransition();
  const { beginRequest } = useStaleRequestGuard();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!auditId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [auditId]);

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

  if (!auditId || !mounted) return null;

  return createPortal(
    <div
      className={cn("platform-modal", elevated && "platform-modal--stacked")}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="platform-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className={cn(
          "platform-modal__panel platform-modal__panel--wide platform-modal__panel--adi",
          elevated && "platform-modal__panel--adi-xl"
        )}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="adi-header">
          <div className="adi-header__left">
            <span className="adi-header__icon" aria-hidden><FileText size={16} /></span>
            <div>
              <h2 className="adi-header__title">Audit Details</h2>
              {detail && (
                <p className="adi-header__code">{detail.auditCode}</p>
              )}
            </div>
          </div>
          <div className="adi-header__actions">
            {detail && canEditAudits && (
              <Link
                href={`/audit-logs/${detail.id}/edit`}
                className="ui-btn ui-btn--secondary ui-btn--sm"
                onClick={onClose}
              >
                <Pencil size={14} aria-hidden />
                Edit
              </Link>
            )}
            <button
              type="button"
              className="adi-header__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="adi-body">
          {isPending && !detail && !error && (
            <LoadingIndicator label="Loading audit…" />
          )}
          {error && (
            <p className="platform-empty platform-empty--error">{error}</p>
          )}

          {detail && (
            <LoadingZone loading={remarksPending} label="Saving remarks…">
            <div className="adi-content">

              {/* ── KPI bar ──────────────────────────────────────── */}
              <div className="adi-kpis">
                <div className={cn("adi-kpi", detail.hasFatal && "adi-kpi--fatal")}>
                  <span className="adi-kpi__label">Quality score</span>
                  <strong className={cn("adi-kpi__val", scoreToneClass(detail.qualityPct))}>
                    {detail.qualityPct}%
                  </strong>
                </div>
                <div className={cn("adi-kpi", detail.hasFatal && "adi-kpi--fatal")}>
                  <span className="adi-kpi__label">Final score</span>
                  <strong className={cn("adi-kpi__val", detail.hasFatal ? "adi-kpi__val--danger" : scoreToneClass(detail.finalPct))}>
                    {detail.hasFatal ? "FAILED" : `${detail.finalPct}%`}
                  </strong>
                </div>
                <div className="adi-kpi">
                  <span className="adi-kpi__label">Grade</span>
                  <span className={gradeClass(detail.grade)}>{detail.grade}</span>
                </div>
                <div className="adi-kpi">
                  <span className="adi-kpi__label">Points</span>
                  <strong className="adi-kpi__val">
                    {detail.totalScored}<span className="adi-kpi__val--sub">/{detail.totalMax}</span>
                  </strong>
                </div>
              </div>

              {/* ── Fatal alert ──────────────────────────────────── */}
              {detail.hasFatal && detail.fatalList.length > 0 && (
                <div className="adi-fatal-alert" role="alert">
                  <ShieldAlert size={16} className="adi-fatal-alert__icon" aria-hidden />
                  <div>
                    <p className="adi-fatal-alert__title">Fatal error — auto-failed</p>
                    <div className="adi-fatal-alert__chips">
                      {detail.fatalList.map((item) => (
                        <span key={item} className="adi-fatal-alert__chip">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Interaction (full-width) ──────────────────────── */}
              <section className="adi-section">
                <h3 className="adi-section__title">
                  <Phone size={13} aria-hidden />
                  Interaction
                </h3>
                <div className="adi-grid adi-grid--4">
                  <Field label="Agent">{detail.agent}</Field>
                  <Field label="Supervisor">{detail.supervisor ?? "—"}</Field>
                  <Field label="Quality analyst">{detail.auditor ?? "—"}</Field>
                  <Field label="Type">{detail.type} · {detail.businessType}</Field>
                  <Field label="LOB">
                    {detail.lob}{detail.sublob ? ` / ${detail.sublob}` : ""}
                  </Field>
                  <Field label="Reason">{detail.reason ?? "—"}</Field>
                  <Field label="Call date">{detail.callDate}</Field>
                  <Field label="Audit date">{detail.auditDate}</Field>
                  {detail.mobile ? (
                    <Field label={interactionContactFieldLabel(detail.type)}>
                      {detail.mobile}
                    </Field>
                  ) : null}
                  <Field label="Submitted by">{detail.submittedBy}</Field>
                  <Field label="Submitted at">{formatDateTime(detail.createdAt)}</Field>
                </div>

                {detail.referenceUrl ? (() => {
                  const refKind = detectReferenceAttachmentKind(
                    normalizeUploadedReferencePath(detail.referenceUrl)
                  );
                  const sectionKind =
                    refKind === "audit"
                      ? "audit"
                      : refKind === "audio"
                        ? "audio"
                        : refKind === "image"
                          ? "image"
                          : "url";
                  return (
                  <div className="adi-reference">
                    <span className="adi-field__label">
                      {interactionReferenceSectionLabel(detail.type, sectionKind)}
                    </span>
                    <ReferenceAttachmentView
                      referenceUrl={detail.referenceUrl}
                      interactionType={detail.type}
                      variant="full"
                    />
                  </div>
                  );
                })() : null}

                {detail.response ? (
                  <div className="adi-reference">
                    <span className="adi-field__label">Response</span>
                    <p className="adi-reference__text">{detail.response}</p>
                  </div>
                ) : null}
              </section>

              {/* ── Feedback (full-width) ─────────────────────────── */}
              <section className="adi-section">
                <h3 className="adi-section__title">
                  <MessageSquare size={13} aria-hidden />
                  Feedback
                </h3>
                <div className="adi-grid adi-grid--4">
                  <Field label={FEEDBACK_SEVERITY_LABEL}>{detail.feedbackSecurity}</Field>
                  <Field label="Status">{detail.feedbackStatus}</Field>
                  <Field label="Feedback date">{formatFeedbackDateTime(detail.feedbackDate)}</Field>
                  {(detail.feedbackStatus === "Acknowledged" ||
                    detail.feedbackStatus === "Disputed" ||
                    detail.feedbackStatusAt) ? (
                    <Field label={
                      detail.feedbackStatus === "Disputed"
                        ? "Disputed at"
                        : "Acknowledged at"
                    }>
                      {formatFeedbackDateTime(detail.feedbackStatusAt)}
                    </Field>
                  ) : null}
                </div>
                {detail.agentFeedback.trim() ? (
                  <div className="adi-agent-feedback">
                    <span className="adi-field__label">Feedback for agent</span>
                    <p className="adi-agent-feedback__text">{detail.agentFeedback.trim()}</p>
                  </div>
                ) : null}
              </section>

              {/* ── Supervisor remarks (full-width) ───────────────── */}
              {(canEditSupervisorRemarks || detail.supervisorRemarks.trim()) && (
                <section className="adi-section adi-section--remarks">
                  <h3 className="adi-section__title">Supervisor remarks</h3>
                  {canEditSupervisorRemarks ? (
                    <>
                      <textarea
                        className="adi-remarks-input"
                        rows={3}
                        value={remarksDraft}
                        onChange={(e) => setRemarksDraft(e.target.value)}
                        placeholder="Add remarks for this audit…"
                      />
                      <div className="adi-remarks-actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn--primary ui-btn--sm"
                          disabled={remarksPending}
                          onClick={saveRemarks}
                        >
                          {remarksPending ? "Saving…" : "Save remarks"}
                        </button>
                        {remarksMessage ? (
                          <span className={cn(
                            "adi-remarks-msg",
                            !remarksMessage.toLowerCase().includes("error") && "adi-remarks-msg--ok"
                          )}>
                            {remarksMessage}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="adi-remarks-text">
                      {detail.supervisorRemarks.trim() || "—"}
                    </p>
                  )}
                </section>
              )}

              {/* ── Bottom: Category scores + Parameter table ─────── */}
              {(Object.keys(detail.catScores).length > 0 || detail.rows.length > 0) && (
                <div className="adi-lower">

                  {/* Category scores */}
                  {Object.keys(detail.catScores).length > 0 && (
                    <section className="adi-section adi-section--cats">
                      <h3 className="adi-section__title">Category scores</h3>
                      <div className="adi-cats">
                        {Object.entries(detail.catScores).map(([name, cat]) => {
                          const pct = cat.max > 0 ? Math.round((cat.scored / cat.max) * 100) : 0;
                          const params = rowsByCategory.get(name) ?? [];
                          const tone = pct >= 90 ? "success" : pct >= 75 ? "warn" : "danger";
                          return (
                            <details key={name} className="adi-cat">
                              <summary className="adi-cat__head">
                                <span className="adi-cat__name">{name}</span>
                                <div className="adi-cat__right">
                                  <div className="adi-cat__bar-track">
                                    <div
                                      className={`adi-cat__bar-fill adi-cat__bar-fill--${tone}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className={`adi-cat__pct adi-cat__pct--${tone}`}>{pct}%</span>
                                  <span className="adi-cat__pts">{cat.scored}/{cat.max}</span>
                                  <ChevronDown size={14} className="adi-cat__chevron" aria-hidden />
                                </div>
                              </summary>
                              {params.length > 0 && (
                                <ul className="adi-cat__params">
                                  {params.map((row: AuditRow) => (
                                    <li key={row.id} className="adi-cat__param">
                                      <span className="adi-cat__param-name">{row.name}</span>
                                      <span className={cn(
                                        "adi-cat__param-sel",
                                        row.fatal && "adi-cat__param-sel--fatal"
                                      )}>
                                        {row.sel}
                                      </span>
                                      <span className="adi-cat__param-pts">{row.score}/{row.max}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </details>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Parameter table */}
                  {detail.rows.length > 0 && (
                    <section className="adi-section adi-section--params">
                      <h3 className="adi-section__title">All parameters</h3>
                      <div className="adi-param-table-wrap">
                        <table className="adi-param-table">
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
                              <tr key={row.id} className={row.fatal ? "adi-param-table__row--fatal" : undefined}>
                                <td className="adi-param-table__cat">{row.cat}</td>
                                <td>{row.name}</td>
                                <td className={cn(row.fatal && "adi-param-table__sel--fatal")}>{row.sel}</td>
                                <td className="adi-param-table__score">{row.score}/{row.max}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>
              )}

            </div>
            </LoadingZone>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
