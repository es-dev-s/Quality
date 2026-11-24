"use client";

import { Button } from "@/components/primitives/button";
import {
  acknowledgeDisputeResolution,
  getDisputeDetail,
  submitDisputeRemark,
  upholdDispute,
  type DisputeDetail,
} from "@/lib/actions/dispute";
import {
  DISPUTE_TEXT_LIMITS,
  TL_ASSESSMENTS,
  TL_ASSESSMENT_LABEL,
  formatDeadlineRemaining,
  type TlAssessment,
} from "@/lib/audit/dispute";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

type DisputePanelProps = {
  auditId: string;
  isHistory?: boolean;
  /** Called after any dispute action so the parent can refresh its row/detail. */
  onChanged?: () => void;
};

const CLOSE_LABEL: Record<string, string> = {
  ACKNOWLEDGED: "Agent acknowledged the resolution",
  ESCALATION_EXPIRED: "Closed — acknowledgement deadline expired",
};

export function DisputePanel({ auditId, isHistory = false, onChanged }: DisputePanelProps) {
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const [assessment, setAssessment] = useState<TlAssessment>("PARTIAL");
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [note, setNote] = useState("");

  const reload = useCallback(async () => {
    const next = await getDisputeDetail(auditId).catch(() => null);
    setDetail(next);
    setLoaded(true);
  }, [auditId]);

  useEffect(() => {
    let cancelled = false;
    getDisputeDetail(auditId)
      .catch(() => null)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auditId]);

  function run(action: () => Promise<{ error?: string } | { success: true }>, okText: string) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      if ("error" in result && result.error) {
        setMessage({ text: result.error, ok: false });
        return;
      }
      setMessage({ text: okText, ok: true });
      await reload();
      onChanged?.();
    });
  }

  if (!loaded || !detail) return null;

  const { state, viewer } = detail;
  const open = state && state.stage !== "CLOSED";

  return (
    <section className="adi-section adi-section--feedback" aria-label="Dispute">
      <h3 className="adi-section__title">Dispute</h3>
      <div className="dispute-panel">
        {state ? (
          <div className="dispute-panel__status">
            <span>{state.label}</span>
            {open && state.deadlineAt ? (
              <span
                className={cn(
                  "dispute-panel__due",
                  state.overdue && "dispute-panel__due--overdue"
                )}
              >
                {formatDeadlineRemaining(state.deadlineAt)} · due{" "}
                {formatFeedbackDateTime(state.deadlineAt.toISOString())}
              </span>
            ) : null}
          </div>
        ) : null}

        {detail.reason ? (
          <div className="dispute-panel__block">
            <span className="dispute-panel__label">
              Agent&apos;s dispute · {formatFeedbackDateTime(detail.raisedAt)}
            </span>
            <p className="dispute-panel__text">{detail.reason}</p>
          </div>
        ) : null}

        {detail.tlRemark ? (
          <div className="dispute-panel__block">
            <span className="dispute-panel__label">
              Supervisor remark · {formatFeedbackDateTime(detail.tlRemarkAt)}
            </span>
            <p className="dispute-panel__text">
              <strong>{TL_ASSESSMENT_LABEL[detail.tlRemark.assessment]}</strong>
            </p>
            <span className="dispute-panel__label">Findings</span>
            <p className="dispute-panel__text">{detail.tlRemark.findings}</p>
            <span className="dispute-panel__label">Recommendation</span>
            <p className="dispute-panel__text">{detail.tlRemark.recommendation}</p>
          </div>
        ) : null}

        {detail.outcome ? (
          <div className="dispute-panel__block">
            <span className="dispute-panel__label">
              Quality Manager outcome ·{" "}
              {detail.outcome === "REVISED" ? "Audit revised" : "Audit upheld"} ·{" "}
              {formatFeedbackDateTime(detail.reviewedAt)}
            </span>
            <p className="dispute-panel__text">{detail.outcomeNote || "—"}</p>
          </div>
        ) : null}

        {detail.revisions.length > 0 ? (
          <div className="dispute-panel__block dispute-panel__versions">
            <span className="dispute-panel__label">
              Version history · current is v{detail.auditVersion}
            </span>
            {detail.revisions.map((r) => (
              <div key={r.version}>
                <strong>v{r.version} (original)</strong>: {r.hasFatal ? "FAILED" : `${r.finalPct}%`} · {r.grade}
                {" — "}revised by {r.approvedByName} on {formatFeedbackDateTime(r.createdAt)}.
                <br />
                <em>{r.rationale}</em>
              </div>
            ))}
          </div>
        ) : null}

        {detail.stage === "CLOSED" && detail.closeReason ? (
          <div className="dispute-panel__due">
            {CLOSE_LABEL[detail.closeReason] ?? "Closed"} · {formatFeedbackDateTime(detail.closedAt)}
          </div>
        ) : null}

        {!isHistory && viewer.canRemark ? (
          <form
            className="dispute-panel__form"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => submitDisputeRemark({ id: auditId, assessment, findings, recommendation }),
                "Remark submitted. The Quality Manager has been notified."
              );
            }}
          >
            <span className="dispute-panel__label">Your remark (required within 24 hours)</span>
            <select
              className="ui-input"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value as TlAssessment)}
              aria-label="Assessment"
            >
              {TL_ASSESSMENTS.map((value) => (
                <option key={value} value={value}>
                  {TL_ASSESSMENT_LABEL[value]}
                </option>
              ))}
            </select>
            <textarea
              className="adi-remarks-input"
              rows={3}
              maxLength={DISPUTE_TEXT_LIMITS.remarkField.max}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Findings: what did you observe on this interaction?"
              aria-label="Findings"
              required
            />
            <textarea
              className="adi-remarks-input"
              rows={2}
              maxLength={DISPUTE_TEXT_LIMITS.remarkField.max}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Recommendation for the Quality Manager"
              aria-label="Recommendation"
              required
            />
            <div className="dispute-panel__actions">
              <Button type="submit" size="sm" loading={pending}>
                Submit remark
              </Button>
            </div>
          </form>
        ) : null}

        {!isHistory && viewer.canReview ? (
          <div className="dispute-panel__form">
            <span className="dispute-panel__label">
              Quality Manager review (required within 24 hours)
            </span>
            <textarea
              className="adi-remarks-input"
              rows={3}
              maxLength={DISPUTE_TEXT_LIMITS.rationale.max}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rationale for upholding the audit as scored (min 10 characters)"
              aria-label="Review rationale"
            />
            <div className="dispute-panel__actions">
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  run(
                    () => upholdDispute(auditId, note),
                    "Audit upheld and reshared with the agent."
                  )
                }
              >
                Uphold &amp; reshare
              </Button>
              <Link
                href={`/audit-logs/${auditId}/edit`}
                className="ui-btn ui-btn--primary ui-btn--sm"
              >
                Revise scores (new version)
              </Link>
            </div>
          </div>
        ) : null}

        {!isHistory && viewer.canAcknowledge ? (
          <div className="dispute-panel__actions">
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () => acknowledgeDisputeResolution(auditId),
                  "Thanks — the dispute is closed."
                )
              }
            >
              Acknowledge resolution
            </Button>
          </div>
        ) : null}

        {message ? (
          <span
            className={cn("adi-remarks-msg", message.ok && "adi-remarks-msg--ok")}
            role="status"
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
