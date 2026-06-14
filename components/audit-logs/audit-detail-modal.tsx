"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { getAuditDetail } from "@/lib/actions/audit";
import type { AuditDetail } from "@/lib/audit/audit-records";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";

type AuditDetailModalProps = {
  auditId: string | null;
  onClose: () => void;
};

function gradeClass(grade: string) {
  if (grade === "Failed") return "dash-grade dash-grade--failed";
  if (grade === "Excellent") return "dash-grade dash-grade--excellent";
  if (grade === "Good") return "dash-grade dash-grade--good";
  return "dash-grade dash-grade--needs";
}

export function AuditDetailModal({ auditId, onClose }: AuditDetailModalProps) {
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { beginRequest } = useStaleRequestGuard();

  useEffect(() => {
    if (!auditId) {
      setDetail(null);
      setError(null);
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
        setError(null);
      } catch {
        if (request.isStale()) return;
        setError("Unable to load audit details.");
        setDetail(null);
      }
    });
  }, [auditId, beginRequest]);

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
            {detail ? (
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
          {error && <p className="platform-empty platform-empty--error">{error}</p>}
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
              </div>

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
                  <span className="audit-detail__field-label">Auditor</span>
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
                  <span className="audit-detail__field-label">Reason</span>
                  <p>{detail.reason ?? "—"}</p>
                </div>
                {detail.subReason ? (
                  <div>
                    <span className="audit-detail__field-label">Sub-reason</span>
                    <p>{detail.subReason}</p>
                  </div>
                ) : null}
                <div>
                  <span className="audit-detail__field-label">Submitted by</span>
                  <p>{detail.submittedBy}</p>
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
                </div>
                {detail.agentFeedback.trim() ? (
                  <div className="audit-detail__agent-feedback">
                    <span className="audit-detail__field-label">
                      Feedback for the agent
                    </span>
                    <p>{detail.agentFeedback}</p>
                  </div>
                ) : (
                  <div className="audit-detail__agent-feedback">
                    <span className="audit-detail__field-label">
                      Feedback for the agent
                    </span>
                    <p>—</p>
                  </div>
                )}
              </div>

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
                  <h3 className="audit-detail__section-title">
                    Category scores
                  </h3>
                  <div className="audit-detail__cat-grid">
                    {Object.entries(detail.catScores).map(([name, cat]) => {
                      const pct =
                        cat.max > 0
                          ? Math.round((cat.scored / cat.max) * 100)
                          : 0;
                      return (
                        <div key={name} className="audit-detail__cat-row">
                          <span>{name}</span>
                          <strong>
                            {cat.scored}/{cat.max} ({pct}%)
                          </strong>
                        </div>
                      );
                    })}
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
