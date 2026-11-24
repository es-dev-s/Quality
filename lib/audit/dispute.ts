/**
 * Dispute workflow: stages, SLA deadlines and derived state.
 *
 * Flow
 *   Shared ──(agent, ≤48h)──▶ Disputed / AWAITING_TL_REMARK
 *     ──(team lead remark, ≤24h)──▶ AWAITING_QM_REVIEW
 *     ──(Quality Manager, ≤24h)──▶ AWAITING_FINAL_ACK  (audit reshared)
 *     ──(agent ack, ≤24h of reshare)──▶ CLOSED
 *
 * Deadlines are derived from stored timestamps; nothing here touches the DB.
 */

export const HOUR_MS = 60 * 60 * 1000;

export const DISPUTE_SLA_HOURS = {
  /** Agent acknowledges shared feedback. */
  agentAcknowledge: 48,
  /** Agent may raise a dispute after feedback is shared. */
  disputeWindow: 48,
  /** Team lead adds a remark after the dispute is raised. */
  teamLeadRemark: 24,
  /** Quality Manager reviews and reshares after the team-lead remark. */
  qualityManagerReview: 24,
  /** Agent acknowledges the revised / resolved audit after reshare. */
  finalAcknowledge: 24,
} as const;

export const DISPUTE_STAGES = [
  "AWAITING_TL_REMARK",
  "AWAITING_QM_REVIEW",
  "AWAITING_FINAL_ACK",
  "CLOSED",
] as const;
export type DisputeStage = (typeof DISPUTE_STAGES)[number];

export const DISPUTE_OUTCOMES = ["UPHELD", "REVISED"] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export const DISPUTE_CLOSE_REASONS = [
  "ACKNOWLEDGED",
  "ESCALATION_EXPIRED",
] as const;
export type DisputeCloseReason = (typeof DISPUTE_CLOSE_REASONS)[number];

export const TL_ASSESSMENTS = ["AGREE", "PARTIAL", "DISAGREE"] as const;
export type TlAssessment = (typeof TL_ASSESSMENTS)[number];

export const TL_ASSESSMENT_LABEL: Record<TlAssessment, string> = {
  AGREE: "Agree with agent",
  PARTIAL: "Partially agree",
  DISAGREE: "Disagree with agent",
};

/** Structured team-lead remark. */
export type DisputeTlRemark = {
  assessment: TlAssessment;
  /** What happened on the interaction, from the team lead's review. */
  findings: string;
  /** Suggested action for the Quality Manager. */
  recommendation: string;
};

export const DISPUTE_TEXT_LIMITS = {
  reason: { min: 10, max: 2000 },
  remarkField: { min: 5, max: 2000 },
  rationale: { min: 10, max: 2000 },
  note: { max: 2000 },
} as const;

export function parseDisputeStage(value: unknown): DisputeStage | null {
  return (DISPUTE_STAGES as readonly string[]).includes(value as string)
    ? (value as DisputeStage)
    : null;
}

export function parseTlRemark(value: unknown): DisputeTlRemark | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !(TL_ASSESSMENTS as readonly string[]).includes(v.assessment as string) ||
    typeof v.findings !== "string" ||
    typeof v.recommendation !== "string"
  ) {
    return null;
  }
  return {
    assessment: v.assessment as TlAssessment,
    findings: v.findings,
    recommendation: v.recommendation,
  };
}

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function deadline(
  from: Date | string | null | undefined,
  hours: number
): Date | null {
  const ms = toMs(from);
  return ms === null ? null : new Date(ms + hours * HOUR_MS);
}

/** Last moment the agent may dispute feedback shared at `sharedAt`. */
export function disputeWindowDeadline(
  sharedAt: Date | string | null | undefined
): Date | null {
  return deadline(sharedAt, DISPUTE_SLA_HOURS.disputeWindow);
}

export function agentAcknowledgeDeadline(
  sharedAt: Date | string | null | undefined
): Date | null {
  return deadline(sharedAt, DISPUTE_SLA_HOURS.agentAcknowledge);
}

export function canRaiseDisputeAt(
  sharedAt: Date | string | null | undefined,
  now: Date = new Date()
): { ok: true } | { ok: false; error: string } {
  const limit = disputeWindowDeadline(sharedAt);
  if (!limit) {
    return { ok: false, error: "Feedback has not been shared yet." };
  }
  if (now.getTime() > limit.getTime()) {
    return {
      ok: false,
      error: `The ${DISPUTE_SLA_HOURS.disputeWindow}-hour dispute window has closed.`,
    };
  }
  return { ok: true };
}

export type DisputeTimeline = {
  disputeStage: DisputeStage | null;
  disputeRaisedAt: Date | string | null;
  disputeTlRemarkAt: Date | string | null;
  disputeResharedAt: Date | string | null;
};

export type DisputeState = {
  stage: DisputeStage;
  /** Short status text, e.g. "Disputed – Awaiting Supervisor Remark". */
  label: string;
  /** Who must act next, or null when closed. */
  waitingOn: "team_lead" | "quality_manager" | "agent" | null;
  deadlineAt: Date | null;
  /** True once the current stage's deadline has passed and the stage is still open. */
  overdue: boolean;
  /** Overdue past the final-acknowledgement deadline: dispute may be closed by escalation. */
  escalationExpired: boolean;
};

export const DISPUTE_STAGE_LABEL: Record<DisputeStage, string> = {
  AWAITING_TL_REMARK: "Disputed – Awaiting Supervisor Remark",
  AWAITING_QM_REVIEW: "Disputed – Awaiting Quality Manager Review",
  AWAITING_FINAL_ACK: "Dispute Resolved – Awaiting Agent Acknowledgement",
  CLOSED: "Dispute Closed",
};

/** Derive the live state of a dispute, or null when the audit has no dispute. */
export function getDisputeState(
  timeline: DisputeTimeline,
  now: Date = new Date()
): DisputeState | null {
  const stage = parseDisputeStage(timeline.disputeStage);
  if (!stage) return null;

  let deadlineAt: Date | null = null;
  let waitingOn: DisputeState["waitingOn"] = null;

  switch (stage) {
    case "AWAITING_TL_REMARK":
      deadlineAt = deadline(
        timeline.disputeRaisedAt,
        DISPUTE_SLA_HOURS.teamLeadRemark
      );
      waitingOn = "team_lead";
      break;
    case "AWAITING_QM_REVIEW":
      deadlineAt = deadline(
        timeline.disputeTlRemarkAt,
        DISPUTE_SLA_HOURS.qualityManagerReview
      );
      waitingOn = "quality_manager";
      break;
    case "AWAITING_FINAL_ACK":
      deadlineAt = deadline(
        timeline.disputeResharedAt,
        DISPUTE_SLA_HOURS.finalAcknowledge
      );
      waitingOn = "agent";
      break;
    case "CLOSED":
      break;
  }

  const overdue =
    stage !== "CLOSED" &&
    deadlineAt !== null &&
    now.getTime() > deadlineAt.getTime();

  return {
    stage,
    label: DISPUTE_STAGE_LABEL[stage],
    waitingOn,
    deadlineAt,
    overdue,
    escalationExpired: stage === "AWAITING_FINAL_ACK" && overdue,
  };
}

/** "3h 12m left" / "Overdue by 2h 5m". */
export function formatDeadlineRemaining(
  deadlineAt: Date | null,
  now: Date = new Date()
): string {
  if (!deadlineAt) return "";
  const diff = deadlineAt.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / 60_000);
  const span = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diff >= 0 ? `${span} left` : `Overdue by ${span}`;
}

/** Score or parameter changes while a dispute is open need QM approval. */
export function isDisputeOpen(stage: DisputeStage | null): boolean {
  return stage !== null && stage !== "CLOSED";
}
