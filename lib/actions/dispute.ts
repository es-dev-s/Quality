"use server";

import {
  DISPUTE_TEXT_LIMITS,
  TL_ASSESSMENTS,
  canRaiseDisputeAt,
  getDisputeState,
  parseDisputeStage,
  parseTlRemark,
  type DisputeStage,
  type DisputeState,
  type DisputeTlRemark,
} from "@/lib/audit/dispute";
import { closeExpiredDisputes } from "@/lib/audit/dispute-sweep";
import { assertFeedbackStatusChangeAllowed } from "@/lib/audit/feedback-status-access";
import { resolveMemberFeedbackMode } from "@/lib/audit/member-access";
import { scopedAuditByIdWhere } from "@/lib/audit/scoped-audit-query";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";
import { requireAuth } from "@/lib/auth";
import { permissionError } from "@/lib/auth-guards";
import { invalidateAuditCaches } from "@/lib/invalidate-cache";
import { dispatchDisputeAuditNotifications } from "@/lib/notifications/dispatch-dispute-audit";
import {
  dispatchDisputeRemarkSubmitted,
  dispatchDisputeResolved,
} from "@/lib/notifications/dispatch-dispute-workflow";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditFeedbackFully, isSuperAdmin } from "@/lib/rbac";
import { assertWriteRateLimit } from "@/lib/server/rate-limit";
import { cuidSchema } from "@/lib/validation/common";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const L = DISPUTE_TEXT_LIMITS;

const raiseSchema = z.object({
  id: cuidSchema,
  reason: z
    .string()
    .trim()
    .min(L.reason.min, `Explain the dispute in at least ${L.reason.min} characters.`)
    .max(L.reason.max),
});

const remarkSchema = z.object({
  id: cuidSchema,
  assessment: z.enum(TL_ASSESSMENTS),
  findings: z.string().trim().min(L.remarkField.min, "Findings are required.").max(L.remarkField.max),
  recommendation: z
    .string()
    .trim()
    .min(L.remarkField.min, "A recommendation is required.")
    .max(L.remarkField.max),
});

const upholdSchema = z.object({
  id: cuidSchema,
  note: z.string().trim().min(L.rationale.min, `Add a rationale (${L.rationale.min}+ characters).`).max(L.rationale.max),
});

const idSchema = z.object({ id: cuidSchema });

const AUDIT_SELECT = {
  id: true,
  auditCode: true,
  agent: true,
  supervisor: true,
  auditor: true,
  submittedById: true,
  isHistory: true,
  feedbackStatus: true,
  feedbackDate: true,
  disputeStage: true,
} as const;

function refresh(userId: string, auditId: string) {
  revalidatePath("/audit-logs");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  invalidateAuditCaches(userId, { type: "audit:updated", auditId });
}

/** Agent raises a dispute on shared feedback (≤48h after it was shared). */
export async function raiseAuditDispute(id: string, reason: string) {
  const session = await requireAuth();
  const limited = assertWriteRateLimit(session.user.id, "audit:dispute-raise", {
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = raiseSchema.safeParse({ id, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid dispute." };
  }

  const audit = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: AUDIT_SELECT,
  });
  if (!audit) return { error: "Audit not found." };
  if (audit.isHistory) return { error: "History audits cannot be disputed." };

  if (!canEditFeedbackFully(session.user.role)) {
    const memberMode =
      session.user.role.slug === SYSTEM_ROLE_SLUGS.MEMBER
        ? await resolveMemberFeedbackMode(session.user.id)
        : undefined;
    const denied = assertFeedbackStatusChangeAllowed(
      session.user.role,
      "Shared",
      "Disputed",
      memberMode
    );
    if (denied) return { error: denied };
  }

  if (audit.feedbackStatus !== "Shared") {
    return {
      error:
        audit.feedbackStatus === "Pending"
          ? "Feedback has not been shared yet."
          : "Only shared feedback can be disputed.",
    };
  }
  const window = canRaiseDisputeAt(audit.feedbackDate);
  if (!window.ok) return { error: window.error };

  const now = new Date();
  const updated = await prisma.auditSubmission.updateMany({
    // Guard against a concurrent status change.
    where: { id: audit.id, feedbackStatus: "Shared" },
    data: {
      feedbackStatus: "Disputed",
      feedbackStatusAt: now.toISOString(),
      disputeStage: "AWAITING_TL_REMARK" satisfies DisputeStage,
      disputeReason: parsed.data.reason,
      disputeRaisedAt: now,
      disputeRaisedById: session.user.id,
      disputeTlRemarkAt: null,
      disputeTlRemarkById: null,
      disputeReviewedAt: null,
      disputeReviewedById: null,
      disputeOutcome: null,
      disputeOutcomeNote: "",
      disputeResharedAt: null,
      disputeClosedAt: null,
      disputeCloseReason: null,
    },
  });
  if (updated.count === 0) {
    return { error: "This audit's feedback status just changed. Refresh and retry." };
  }

  refresh(session.user.id, audit.id);
  void dispatchDisputeAuditNotifications({
    auditId: audit.id,
    auditCode: audit.auditCode,
    agent: audit.agent,
    supervisor: audit.supervisor,
    auditor: audit.auditor,
    submittedById: audit.submittedById,
    disputedById: session.user.id,
  }).catch((e) => console.error("dispatchDisputeAuditNotifications failed:", e));

  return { success: true as const, feedbackStatusAt: now.toISOString() };
}

/** Team lead submits the structured remark (≤24h after the dispute). */
export async function submitDisputeRemark(input: {
  id: string;
  assessment: DisputeTlRemark["assessment"];
  findings: string;
  recommendation: string;
}) {
  const session = await requireAuth();
  const role = session.user.role;
  if (!isSupervisorTierRole(role.slug) && !isSuperAdmin(role)) {
    return permissionError();
  }
  const limited = assertWriteRateLimit(session.user.id, "audit:dispute-remark", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = remarkSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid remark." };
  }

  const audit = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: AUDIT_SELECT,
  });
  if (!audit) return { error: "Audit not found." };
  if (audit.disputeStage !== "AWAITING_TL_REMARK") {
    return { error: "This dispute is not waiting for a supervisor remark." };
  }

  const remark: DisputeTlRemark = {
    assessment: parsed.data.assessment,
    findings: parsed.data.findings,
    recommendation: parsed.data.recommendation,
  };
  const updated = await prisma.auditSubmission.updateMany({
    where: { id: audit.id, disputeStage: "AWAITING_TL_REMARK" },
    data: {
      disputeStage: "AWAITING_QM_REVIEW" satisfies DisputeStage,
      disputeTlRemark: remark,
      disputeTlRemarkAt: new Date(),
      disputeTlRemarkById: session.user.id,
    },
  });
  if (updated.count === 0) {
    return { error: "A remark was already submitted for this dispute." };
  }

  refresh(session.user.id, audit.id);
  void dispatchDisputeRemarkSubmitted({
    auditId: audit.id,
    auditCode: audit.auditCode,
    agent: audit.agent,
    submittedById: session.user.id,
  }).catch((e) => console.error("dispatchDisputeRemarkSubmitted failed:", e));

  return { success: true as const };
}

/**
 * Quality Manager upholds the audit unchanged and reshares it. Score or
 * parameter changes go through `updateAuditSubmission` (new audit version).
 */
export async function upholdDispute(id: string, note: string) {
  const session = await requireAuth();
  const role = session.user.role;
  if (role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER && !isSuperAdmin(role)) {
    return permissionError();
  }
  const limited = assertWriteRateLimit(session.user.id, "audit:dispute-uphold", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = upholdSchema.safeParse({ id, note });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid review." };
  }

  const audit = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: AUDIT_SELECT,
  });
  if (!audit) return { error: "Audit not found." };
  if (audit.disputeStage !== "AWAITING_QM_REVIEW") {
    return { error: "This dispute is not waiting for Quality Manager review." };
  }

  const now = new Date();
  const updated = await prisma.auditSubmission.updateMany({
    where: { id: audit.id, disputeStage: "AWAITING_QM_REVIEW" },
    data: {
      feedbackStatus: "Shared",
      feedbackDate: now.toISOString(),
      feedbackStatusAt: null,
      disputeStage: "AWAITING_FINAL_ACK" satisfies DisputeStage,
      disputeOutcome: "UPHELD",
      disputeOutcomeNote: parsed.data.note,
      disputeReviewedAt: now,
      disputeReviewedById: session.user.id,
      disputeResharedAt: now,
    },
  });
  if (updated.count === 0) {
    return { error: "This dispute was already reviewed." };
  }

  refresh(session.user.id, audit.id);
  void dispatchDisputeResolved({
    auditId: audit.id,
    auditCode: audit.auditCode,
    agent: audit.agent,
    outcome: "UPHELD",
    resolvedById: session.user.id,
  }).catch((e) => console.error("dispatchDisputeResolved failed:", e));

  return { success: true as const };
}

/** Agent acknowledges the resolved / revised audit, closing the dispute. */
export async function acknowledgeDisputeResolution(id: string) {
  const session = await requireAuth();
  const limited = assertWriteRateLimit(session.user.id, "audit:dispute-ack", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return { error: "Invalid audit." };

  const audit = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: AUDIT_SELECT,
  });
  if (!audit) return { error: "Audit not found." };

  if (!canEditFeedbackFully(session.user.role)) {
    const memberMode =
      session.user.role.slug === SYSTEM_ROLE_SLUGS.MEMBER
        ? await resolveMemberFeedbackMode(session.user.id)
        : undefined;
    const denied = assertFeedbackStatusChangeAllowed(
      session.user.role,
      "Shared",
      "Acknowledged",
      memberMode
    );
    if (denied) return { error: denied };
  }

  if (audit.disputeStage !== "AWAITING_FINAL_ACK") {
    return { error: "This dispute is not waiting for your acknowledgement." };
  }

  const now = new Date();
  const updated = await prisma.auditSubmission.updateMany({
    where: { id: audit.id, disputeStage: "AWAITING_FINAL_ACK" },
    data: {
      feedbackStatus: "Acknowledged",
      feedbackStatusAt: now.toISOString(),
      disputeStage: "CLOSED" satisfies DisputeStage,
      disputeClosedAt: now,
      disputeCloseReason: "ACKNOWLEDGED",
    },
  });
  if (updated.count === 0) {
    return { error: "This dispute was already closed." };
  }

  refresh(session.user.id, audit.id);
  return { success: true as const, feedbackStatusAt: now.toISOString() };
}

export type DisputeRevisionView = {
  version: number;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  rationale: string;
  outcome: string;
  approvedByName: string;
  createdAt: string;
};

export type DisputeViewer = {
  /** Team lead can submit the structured remark now. */
  canRemark: boolean;
  /** Quality Manager can review (uphold or revise) now. */
  canReview: boolean;
  /** Agent can acknowledge the resolution now. */
  canAcknowledge: boolean;
};

export type DisputeDetail = {
  viewer: DisputeViewer;
  state: DisputeState | null;
  stage: DisputeStage | null;
  reason: string;
  raisedAt: string | null;
  tlRemark: DisputeTlRemark | null;
  tlRemarkAt: string | null;
  outcome: string | null;
  outcomeNote: string;
  reviewedAt: string | null;
  resharedAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
  auditVersion: number;
  revisions: DisputeRevisionView[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Dispute timeline, remark and preserved versions for the audit detail view. */
export async function getDisputeDetail(id: string): Promise<DisputeDetail | null> {
  const session = await requireAuth();
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) return null;

  await closeExpiredDisputes().catch(() => undefined);

  const row = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: {
      disputeStage: true,
      disputeReason: true,
      disputeRaisedAt: true,
      disputeTlRemark: true,
      disputeTlRemarkAt: true,
      disputeOutcome: true,
      disputeOutcomeNote: true,
      disputeReviewedAt: true,
      disputeResharedAt: true,
      disputeClosedAt: true,
      disputeCloseReason: true,
      auditVersion: true,
      revisions: {
        orderBy: { version: "asc" },
        select: {
          version: true,
          qualityPct: true,
          finalPct: true,
          grade: true,
          hasFatal: true,
          rationale: true,
          outcome: true,
          createdAt: true,
          approvedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!row) return null;

  const stage = parseDisputeStage(row.disputeStage);
  if (!stage && row.revisions.length === 0) return null;

  const role = session.user.role;
  const admin = isSuperAdmin(role);
  let canAcknowledge = false;
  if (stage === "AWAITING_FINAL_ACK") {
    if (canEditFeedbackFully(role)) {
      canAcknowledge = true;
    } else {
      const memberMode =
        role.slug === SYSTEM_ROLE_SLUGS.MEMBER
          ? await resolveMemberFeedbackMode(session.user.id)
          : undefined;
      canAcknowledge =
        assertFeedbackStatusChangeAllowed(role, "Shared", "Acknowledged", memberMode) ===
          null && role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST &&
        role.slug !== SYSTEM_ROLE_SLUGS.QUALITY_MANAGER;
    }
  }

  return {
    viewer: {
      canRemark:
        stage === "AWAITING_TL_REMARK" && (admin || isSupervisorTierRole(role.slug)),
      canReview:
        stage === "AWAITING_QM_REVIEW" &&
        (admin || role.slug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER),
      canAcknowledge,
    },
    state: getDisputeState({
      disputeStage: stage,
      disputeRaisedAt: row.disputeRaisedAt,
      disputeTlRemarkAt: row.disputeTlRemarkAt,
      disputeResharedAt: row.disputeResharedAt,
    }),
    stage,
    reason: row.disputeReason,
    raisedAt: iso(row.disputeRaisedAt),
    tlRemark: parseTlRemark(row.disputeTlRemark),
    tlRemarkAt: iso(row.disputeTlRemarkAt),
    outcome: row.disputeOutcome,
    outcomeNote: row.disputeOutcomeNote,
    reviewedAt: iso(row.disputeReviewedAt),
    resharedAt: iso(row.disputeResharedAt),
    closedAt: iso(row.disputeClosedAt),
    closeReason: row.disputeCloseReason,
    auditVersion: row.auditVersion,
    revisions: row.revisions.map((r) => ({
      version: r.version,
      qualityPct: r.qualityPct,
      finalPct: r.finalPct,
      grade: r.grade,
      hasFatal: r.hasFatal,
      rationale: r.rationale,
      outcome: r.outcome,
      approvedByName: r.approvedBy.name?.trim() || r.approvedBy.email,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
