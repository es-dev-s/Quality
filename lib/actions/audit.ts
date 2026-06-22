"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  permissionError,
  requirePermission,
} from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import { canEditFeedbackFully, canEditSupervisorRemarks, hasScope, isSuperAdmin } from "@/lib/rbac";
import { scopedAuditByIdWhere, scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { resolveStatusTimestamps } from "@/lib/audit/feedback-datetime";
import {
  assertFeedbackStatusChangeAllowed,
  canChangeFeedbackStatusInAuditLogs,
} from "@/lib/audit/feedback-status-access";
import { calculateResults } from "@/lib/audit/calculate-results";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { validateAuditFormAgainstConfig } from "@/lib/audit/validate-audit-form-config";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { getTemplateById } from "@/lib/actions/templates";
import { fetchAuditTemplateForEdit } from "@/lib/audit/template-db";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { assertWriteRateLimit } from "@/lib/server/rate-limit";
import {
  auditIdSchema,
  deleteAuditSubmissionsSchema,
  saveAuditSubmissionSchema,
  updateAuditFeedbackSchema,
  updateAuditSubmissionSchema,
  updateSupervisorRemarksSchema,
} from "@/lib/validation/audit";
import { paginationLimitSchema } from "@/lib/validation/common";
import { toIsoTimestamp } from "@/lib/db/to-iso-timestamp";
import { cacheScopeFromSession } from "@/lib/cache";
import {
  getCachedAuditLogs,
  getCachedAuditSubmissionsPage,
  getCachedDashboardRecords,
  parseAuditPageLimit,
} from "@/lib/cached-queries/audit-submissions";
import { invalidateAuditCaches } from "@/lib/invalidate-cache";
import { ACTIVE_USER_WHERE } from "@/lib/user-active-filter";
import { normalizeLegacyReferenceFields } from "@/lib/audit/validate-interaction-details";
import {
  defaultAuditFeedback,
  normalizeFeedbackForSave,
  parseFeedbackSecurity,
  parseFeedbackStatus,
  validateFeedbackForSave,
  type FeedbackSecurity,
  type FeedbackStatus,
  type AuditFeedbackFields,
} from "@/lib/audit/feedback";
import type {
  AuditDetail,
  AuditEditPayload,
  AuditLogEntry,
  DashboardAuditData,
} from "@/lib/audit/audit-records";
import type {
  AuditFormData,
  AuditRecord,
  AuditRow,
  CategoryScore,
  ScoresMap,
} from "@/lib/audit/types";

function validationError(message: string) {
  return { error: message };
}

function revalidateAuditPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/reports");
}

function recordFromStoredSubmission(
  submission: { record: unknown; auditCode: string }
): AuditRecord | null {
  if (!submission.record || typeof submission.record !== "object") {
    return null;
  }
  return submission.record as AuditRecord;
}

async function findIdempotentSubmission(
  submissionKey: string,
  submittedById: string
) {
  const existing = await prisma.auditSubmission.findUnique({
    where: { submissionKey },
    select: { submittedById: true, record: true, auditCode: true },
  });
  if (!existing) return null;
  if (existing.submittedById !== submittedById) {
    return { error: "This submission key is already in use." } as const;
  }
  const record = recordFromStoredSubmission(existing);
  if (!record) {
    return { error: "Could not load the existing submission." } as const;
  }
  return { success: true as const, record };
}

export async function getAuditors() {
  await requirePermission(PERMISSIONS.AUDIT_FORM_READ);
  const config = await getInteractionConfig();
  return config.auditors;
}

export type AuditReferenceOption = {
  id: string;
  auditCode: string;
  agent: string;
  auditDate: string;
  type: string;
};

export async function getAuditReferenceOptions(): Promise<AuditReferenceOption[]> {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_READ);
  const where = await scopedAuditWhere(session);

  const rows = await prisma.auditSubmission.findMany({
    where,
    select: {
      id: true,
      auditCode: true,
      agent: true,
      auditDate: true,
      type: true,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return rows.map((row) => ({
    id: row.id,
    auditCode: row.auditCode,
    agent: row.agent,
    auditDate: row.auditDate,
    type: row.type,
  }));
}

export async function saveAuditSubmission(
  formData: AuditFormData,
  scores: ScoresMap,
  templateId: string,
  options?: { submissionKey?: string }
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_WRITE);

  const rateLimited = assertWriteRateLimit(session.user.id, "audit:save", {
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const parsed = saveAuditSubmissionSchema.safeParse({
    formData,
    scores,
    templateId,
    submissionKey: options?.submissionKey,
  });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid audit submission."
    );
  }

  const {
    formData: validFormData,
    scores: validScores,
    templateId: validTemplateId,
    submissionKey,
  } = parsed.data;

  if (submissionKey) {
    const idempotent = await findIdempotentSubmission(
      submissionKey,
      session.user.id
    );
    if (idempotent) {
      if ("error" in idempotent) return idempotent;
      return idempotent;
    }
  }

  const template = await getTemplateById(validTemplateId);
  if (!template) {
    return { error: "Audit template not found." };
  }

  const [interactionConfig, users] = await Promise.all([
    getInteractionConfig(),
    prisma.user.findMany({
      where: ACTIVE_USER_WHERE,
      select: { name: true, email: true },
    }),
  ]);
  const configError = validateAuditFormAgainstConfig(
    validFormData,
    interactionConfig,
    users
  );
  if (configError) {
    return { error: configError };
  }

  const feedbackError = validateFeedbackForSave({
    feedbackSecurity: validFormData.feedbackSecurity,
    feedbackStatus: validFormData.feedbackStatus,
    feedbackDate: validFormData.feedbackDate,
  });
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave({
    feedbackSecurity: validFormData.feedbackSecurity,
    feedbackStatus: validFormData.feedbackStatus,
    feedbackDate: validFormData.feedbackDate,
  });

  const result = calculateResults(
    validFormData,
    validScores,
    template,
    feedback
  );

  if (!result.ok) {
    return { error: result.error };
  }

  const record = result.record;

  const submissionData = {
    auditCode: record.id,
    templateId: template.id,
    submittedById: session.user.id,
    agent: record.agent,
    supervisor: record.supervisor || null,
    auditor: record.auditor || null,
    type: record.type,
    businessType: record.businessType,
    callDate: record.callDate,
    auditDate: record.auditDate,
    lob: record.lob,
    sublob: record.sublob || null,
    reason: record.reason || null,
    mobile: record.mobile?.trim() || null,
    referenceUrl: record.referenceUrl?.trim() || null,
    response: record.response || null,
    qualityPct: record.qualityPct,
    finalPct: record.finalPct,
    grade: record.grade,
    hasFatal: record.hasFatal,
    fatalList: record.fatalList,
    feedbackStatus: feedback.feedbackStatus,
    feedbackSecurity: feedback.feedbackSecurity,
    feedbackDate: feedback.feedbackDate || null,
    feedbackStatusAt: feedback.feedbackStatusAt || null,
    agentFeedback: validFormData.agentFeedback.trim(),
    totalScored: record.totalScored,
    totalMax: record.totalMax,
    scores: validScores,
    catScores: record.catScores,
    rows: record.rows,
    record: record as unknown as object,
    submissionKey: submissionKey ?? null,
  };

  let createdId: string | undefined;

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await prisma.auditSubmission.create({
          data: submissionData,
        });
        createdId = created.id;
        break;
      } catch (error) {
        if (
          submissionKey &&
          isPrismaUniqueViolation(error, "submissionKey")
        ) {
          const idempotent = await findIdempotentSubmission(
            submissionKey,
            session.user.id
          );
          if (idempotent) {
            if ("error" in idempotent) return idempotent;
            return idempotent;
          }
        }
        if (isPrismaUniqueViolation(error, "auditCode") && attempt < 2) {
          const retry = calculateResults(
            validFormData,
            validScores,
            template,
            feedback
          );
          if (!retry.ok) {
            return { error: retry.error };
          }
          submissionData.auditCode = retry.record.id;
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error("saveAuditSubmission failed:", error);
    return {
      error: "Could not save this audit. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");

  invalidateAuditCaches(session.user.id, {
    type: "audit:created",
    auditId: createdId ?? record.id,
    submittedById: session.user.id,
  });

  return { success: true, record };
}

function parseFatalList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseCatScores(value: unknown): Record<string, CategoryScore> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, CategoryScore>;
}

function parseRows(value: unknown): AuditRow[] {
  if (!Array.isArray(value)) return [];
  return value as AuditRow[];
}

type AuditLogRow = {
  id: string;
  auditCode: string;
  agent: string;
  supervisor: string | null;
  lob: string;
  sublob: string | null;
  reason: string | null;
  type: string;
  businessType: string;
  callDate: string;
  auditDate: string;
  auditor: string | null;
  qualityPct: number;
  finalPct: number;
  grade: string;
  hasFatal: boolean;
  feedbackSecurity: string;
  feedbackStatus: string;
  feedbackDate: string | null;
  feedbackStatusAt: string | null;
  agentFeedback: string;
  supervisorRemarks: string;
  referenceUrl: string | null;
  mobile: string | null;
  submittedBy: { name: string | null; email: string };
  createdAt: Date | string;
};

function mapAuditSubmission(s: AuditLogRow): AuditLogEntry {
  const legacy = normalizeLegacyReferenceFields(
    s.mobile ?? "",
    s.referenceUrl
  );

  return {
    id: s.id,
    auditCode: s.auditCode,
    agent: s.agent,
    supervisor: s.supervisor,
    lob: s.lob,
    sublob: s.sublob,
    reason: s.reason,
    type: s.type,
    businessType: s.businessType,
    callDate: s.callDate,
    auditDate: s.auditDate,
    auditor: s.auditor,
    qualityPct: s.qualityPct,
    finalPct: s.finalPct,
    grade: s.grade,
    hasFatal: s.hasFatal,
    feedbackSecurity: parseFeedbackSecurity(s.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(s.feedbackStatus),
    feedbackDate: s.feedbackDate,
    feedbackStatusAt: s.feedbackStatusAt,
    agentFeedback: s.agentFeedback ?? "",
    supervisorRemarks: s.supervisorRemarks ?? "",
    mobile: legacy.mobile || null,
    referenceUrl: legacy.referenceUrl || null,
    submittedBy: s.submittedBy.name ?? s.submittedBy.email,
    createdAt: toIsoTimestamp(s.createdAt),
  };
}

export async function getAuditLogs(limit = 500) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  const parsedLimit = paginationLimitSchema.safeParse(limit);
  const take = parsedLimit.success ? parsedLimit.data : 500;

  const scope = cacheScopeFromSession(session);
  const submissions = await getCachedAuditLogs(scope, take)();

  return {
    total: submissions.length,
    submissions: submissions.map(mapAuditSubmission),
  };
}

export async function getAuditSubmissions(input?: {
  cursor?: string;
  limit?: number;
}) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  const scope = cacheScopeFromSession(session);
  const limit = parseAuditPageLimit(input?.limit);

  const page = await getCachedAuditSubmissionsPage(
    scope,
    input?.cursor,
    limit
  )();

  return {
    items: page.items.map((row) => ({
      id: row.id,
      auditCode: row.auditCode,
      auditDate: row.auditDate,
      auditor: row.auditor,
      finalPct: row.finalPct,
      feedbackStatus: parseFeedbackStatus(row.feedbackStatus),
      createdAt: toIsoTimestamp(row.createdAt),
      agent: row.agent,
      type: row.type,
      grade: row.grade,
      hasFatal: row.hasFatal,
      templateName: row.template?.name ?? null,
      submittedBy:
        row.submittedBy.name ?? row.submittedBy.email ?? "Unknown",
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function getAuditDetail(id: string) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  const parsedId = auditIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return null;
  }

  const submission = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsedId.data.id),
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
  });

  if (!submission) return null;

  const legacy = normalizeLegacyReferenceFields(
    submission.mobile ?? "",
    submission.referenceUrl
  );

  return {
    id: submission.id,
    auditCode: submission.auditCode,
    agent: submission.agent,
    supervisor: submission.supervisor,
    auditor: submission.auditor,
    type: submission.type,
    businessType: submission.businessType,
    callDate: submission.callDate,
    auditDate: submission.auditDate,
    lob: submission.lob,
    sublob: submission.sublob,
    reason: submission.reason,
    subReason:
      typeof (submission.record as { subReason?: unknown })?.subReason ===
      "string"
        ? (submission.record as { subReason: string }).subReason
        : null,
    mobile: legacy.mobile || null,
    referenceUrl: legacy.referenceUrl || null,
    response: submission.response,
    qualityPct: submission.qualityPct,
    finalPct: submission.finalPct,
    grade: submission.grade,
    hasFatal: submission.hasFatal,
    fatalList: parseFatalList(submission.fatalList),
    feedbackSecurity: parseFeedbackSecurity(submission.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(submission.feedbackStatus),
    feedbackDate: submission.feedbackDate,
    feedbackStatusAt: submission.feedbackStatusAt,
    agentFeedback: submission.agentFeedback ?? "",
    supervisorRemarks: submission.supervisorRemarks ?? "",
    totalScored: submission.totalScored,
    totalMax: submission.totalMax,
    catScores: parseCatScores(submission.catScores),
    rows: parseRows(submission.rows),
    submittedBy:
      submission.submittedBy.name ?? submission.submittedBy.email,
    createdAt: submission.createdAt.toISOString(),
  } satisfies AuditDetail;
}

function parseScoresMap(value: unknown): ScoresMap {
  if (!value || typeof value !== "object") return {};
  const out: ScoresMap = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === "string") out[key] = val;
  }
  return out;
}

function resolveSubmissionTemplateId(
  templateId: string | null | undefined,
  type: string
): string {
  if (templateId) return templateId;
  return type === "Chat" ? "chat" : "call";
}

function submissionToFormData(
  submission: Awaited<ReturnType<typeof fetchAuditSubmissionById>>
): AuditFormData | null {
  if (!submission) return null;

  const legacy = normalizeLegacyReferenceFields(
    submission.mobile ?? "",
    submission.referenceUrl
  );

  return {
    agent: submission.agent,
    supervisor: submission.supervisor ?? "",
    auditor: submission.auditor ?? "",
    type: submission.type as AuditFormData["type"],
    businessType: submission.businessType,
    callDate: submission.callDate,
    auditDate: submission.auditDate,
    lob: submission.lob,
    sublob: submission.sublob ?? "",
    mobile: legacy.mobile,
    referenceUrl: legacy.referenceUrl,
    reason: submission.reason ?? "",
    subReason: "",
    response: submission.response ?? "",
    ...defaultAuditFeedback(),
    feedbackSecurity: parseFeedbackSecurity(submission.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(submission.feedbackStatus),
    feedbackDate: submission.feedbackDate ?? "",
    agentFeedback: submission.agentFeedback ?? "",
  };
}

async function fetchAuditSubmissionById(
  session: Awaited<ReturnType<typeof requireAuth>>,
  id: string
) {
  return prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, id),
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
  });
}

export async function getAuditForEdit(id: string): Promise<AuditEditPayload | null> {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_WRITE);
  const parsedId = auditIdSchema.safeParse({ id });
  if (!parsedId.success) {
    return null;
  }

  const submission = await fetchAuditSubmissionById(session, parsedId.data.id);
  if (!submission) return null;

  const templateId = resolveSubmissionTemplateId(
    submission.templateId,
    submission.type
  );
  const template = await fetchAuditTemplateForEdit(
    templateId,
    submission.type
  );
  if (!template) return null;

  const formData = submissionToFormData(submission);
  if (!formData) return null;

  return {
    id: submission.id,
    auditCode: submission.auditCode,
    templateId,
    formData,
    scores: parseScoresMap(submission.scores),
  };
}

export async function updateAuditSubmission(
  id: string,
  formData: AuditFormData,
  scores: ScoresMap,
  templateId: string
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_WRITE);

  const rateLimited = assertWriteRateLimit(session.user.id, "audit:update", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const parsed = updateAuditSubmissionSchema.safeParse({
    id,
    formData,
    scores,
    templateId,
  });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid audit update."
    );
  }

  const {
    id: validId,
    formData: validFormData,
    scores: validScores,
    templateId: validTemplateId,
  } = parsed.data;

  const existing = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, validId),
    select: {
      id: true,
      auditCode: true,
      feedbackStatus: true,
      submittedById: true,
    },
  });
  if (!existing) {
    return { error: "Audit not found." };
  }

  const template = await fetchAuditTemplateForEdit(
    validTemplateId,
    validFormData.type
  );
  if (!template) {
    return { error: "Audit template not found." };
  }

  const [interactionConfig, users] = await Promise.all([
    getInteractionConfig(),
    prisma.user.findMany({
      where: ACTIVE_USER_WHERE,
      select: { name: true, email: true },
    }),
  ]);
  const configError = validateAuditFormAgainstConfig(
    validFormData,
    interactionConfig,
    users
  );
  if (configError) {
    return { error: configError };
  }

  const feedbackError = validateFeedbackForSave({
    feedbackSecurity: validFormData.feedbackSecurity,
    feedbackStatus: validFormData.feedbackStatus,
    feedbackDate: validFormData.feedbackDate,
  });
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave({
    feedbackSecurity: validFormData.feedbackSecurity,
    feedbackStatus: validFormData.feedbackStatus,
    feedbackDate: validFormData.feedbackDate,
  });

  const result = calculateResults(
    validFormData,
    validScores,
    template,
    {
      id: existing.auditCode,
      ...feedback,
    }
  );

  if (!result.ok) {
    return { error: result.error };
  }

  const record = result.record;

  try {
    const updated = await prisma.auditSubmission.updateMany({
      where: await scopedAuditByIdWhere(session, validId),
      data: {
        templateId: template.id,
        agent: record.agent,
        supervisor: record.supervisor || null,
        auditor: record.auditor || null,
        type: record.type,
        businessType: record.businessType,
        callDate: record.callDate,
        auditDate: record.auditDate,
        lob: record.lob,
        sublob: record.sublob || null,
        reason: record.reason || null,
        mobile: record.mobile?.trim() || null,
        referenceUrl: record.referenceUrl?.trim() || null,
        response: record.response || null,
        qualityPct: record.qualityPct,
        finalPct: record.finalPct,
        grade: record.grade,
        hasFatal: record.hasFatal,
        fatalList: record.fatalList,
        feedbackStatus: feedback.feedbackStatus,
        feedbackSecurity: feedback.feedbackSecurity,
        feedbackDate: feedback.feedbackDate || null,
        feedbackStatusAt: feedback.feedbackStatusAt || null,
        agentFeedback: validFormData.agentFeedback.trim(),
        totalScored: record.totalScored,
        totalMax: record.totalMax,
        scores: validScores,
        catScores: record.catScores,
        rows: record.rows,
        record: record as unknown as object,
      },
    });

    if (updated.count === 0) {
      return { error: "Audit not found." };
    }
  } catch (error) {
    console.error("updateAuditSubmission failed:", error);
    return {
      error: "Could not save changes to this audit. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath(`/audit-logs/${validId}/edit`);
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");

  invalidateAuditCaches(session.user.id, {
    type: "audit:updated",
    auditId: validId,
  });

  return { success: true, record };
}

export async function updateAuditFeedback(
  id: string,
  data: {
    feedbackSecurity: FeedbackSecurity;
    feedbackStatus: FeedbackStatus;
    feedbackDate: string;
    feedbackStatusAt?: string;
  }
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  if (
    !canChangeFeedbackStatusInAuditLogs(session.user.role) &&
    !canEditFeedbackFully(session.user.role)
  ) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(session.user.id, "audit:feedback", {
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const parsed = updateAuditFeedbackSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid feedback update."
    );
  }

  const existing = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    select: {
      id: true,
      feedbackSecurity: true,
      feedbackStatus: true,
      feedbackDate: true,
      feedbackStatusAt: true,
    },
  });
  if (!existing) {
    return { error: "Audit not found." };
  }

  const previousStatus = parseFeedbackStatus(existing.feedbackStatus);
  const nextStatusParsed = parseFeedbackStatus(parsed.data.feedbackStatus);

  if (!canEditFeedbackFully(session.user.role)) {
    const statusError = assertFeedbackStatusChangeAllowed(
      session.user.role,
      previousStatus,
      nextStatusParsed
    );
    if (statusError) {
      return { error: statusError };
    }
  }

  const canEditAllFeedback = canEditFeedbackFully(session.user.role);

  const merged = canEditAllFeedback
    ? {
        feedbackSecurity: parsed.data.feedbackSecurity,
        feedbackStatus: parsed.data.feedbackStatus,
        feedbackDate: parsed.data.feedbackDate,
        feedbackStatusAt: parsed.data.feedbackStatusAt ?? "",
      }
    : {
        feedbackSecurity: parseFeedbackSecurity(existing.feedbackSecurity),
        feedbackStatus: parsed.data.feedbackStatus,
        feedbackDate:
          parsed.data.feedbackStatus === "Shared"
            ? parsed.data.feedbackDate
            : (existing.feedbackDate ?? ""),
        feedbackStatusAt:
          parsed.data.feedbackStatus === "Acknowledged" ||
          parsed.data.feedbackStatus === "Disputed"
            ? (parsed.data.feedbackStatusAt ?? existing.feedbackStatusAt ?? "")
            : (existing.feedbackStatusAt ?? ""),
      };

  const timestamps = resolveStatusTimestamps({
    feedbackStatus: parseFeedbackStatus(merged.feedbackStatus),
    feedbackDate: merged.feedbackDate,
    feedbackStatusAt: merged.feedbackStatusAt ?? "",
    previousStatus,
    existingFeedbackDate: existing.feedbackDate,
    existingFeedbackStatusAt: existing.feedbackStatusAt,
  });

  const payload: AuditFeedbackFields = {
    feedbackSecurity: parseFeedbackSecurity(merged.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(merged.feedbackStatus),
    feedbackDate: timestamps.feedbackDate ?? "",
    feedbackStatusAt: timestamps.feedbackStatusAt ?? "",
  };

  const feedbackError = validateFeedbackForSave(payload);
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave(payload);

  const updated = await prisma.auditSubmission.updateMany({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    data: {
      feedbackSecurity: feedback.feedbackSecurity,
      feedbackStatus: feedback.feedbackStatus,
      feedbackDate: feedback.feedbackDate || null,
      feedbackStatusAt: feedback.feedbackStatusAt || null,
    },
  });

  if (updated.count === 0) {
    return { error: "Audit not found." };
  }

  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/reports");

  invalidateAuditCaches(session.user.id, {
    type: "audit:updated",
    auditId: parsed.data.id,
    changes: {
      feedbackSecurity: feedback.feedbackSecurity,
      feedbackStatus: feedback.feedbackStatus,
      feedbackDate: feedback.feedbackDate || null,
      feedbackStatusAt: feedback.feedbackStatusAt || null,
    },
  });

  return {
    success: true as const,
    feedbackDate: feedback.feedbackDate || null,
    feedbackStatusAt: feedback.feedbackStatusAt || null,
    feedbackStatus: feedback.feedbackStatus,
  };
}

export async function updateSupervisorRemarks(
  id: string,
  supervisorRemarks: string
) {
  const session = await requireAuth();
  if (!canEditSupervisorRemarks(session.user.role)) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "audit:supervisor-remarks",
    { limit: 30, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = updateSupervisorRemarksSchema.safeParse({
    id,
    supervisorRemarks,
  });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid remarks."
    );
  }

  const updated = await prisma.auditSubmission.updateMany({
    where: await scopedAuditByIdWhere(session, parsed.data.id),
    data: { supervisorRemarks: parsed.data.supervisorRemarks },
  });

  if (updated.count === 0) {
    return { error: "Audit not found." };
  }

  revalidatePath("/audit-logs");

  invalidateAuditCaches(session.user.id, {
    type: "audit:updated",
    auditId: parsed.data.id,
  });

  return { success: true as const };
}

export async function deleteAuditSubmissions(ids: string[]) {
  const session = await requireAuth();
  if (!isSuperAdmin(session.user.role)) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(session.user.id, "audit:delete", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const parsed = deleteAuditSubmissionsSchema.safeParse({ ids });
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "Invalid delete request."
    );
  }

  const uniqueIds = [...new Set(parsed.data.ids)];

  try {
    const result = await prisma.auditSubmission.deleteMany({
      where: { id: { in: uniqueIds } },
    });

    if (result.count === 0) {
      return { error: "No matching audits found." };
    }

    revalidateAuditPaths();

    for (const id of uniqueIds) {
      invalidateAuditCaches(session.user.id, {
        type: "audit:deleted",
        auditId: id,
      });
    }

    return { success: true as const, deleted: result.count };
  } catch (error) {
    console.error("deleteAuditSubmissions failed:", error);
    return { error: "Could not delete the selected audits. Please try again." };
  }
}

/** @deprecated Use updateAuditFeedback */
export async function updateAuditFeedbackStatus(
  id: string,
  feedbackStatus: FeedbackStatus
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  if (
    !canChangeFeedbackStatusInAuditLogs(session.user.role) &&
    !canEditFeedbackFully(session.user.role)
  ) {
    return permissionError();
  }

  const existing = await prisma.auditSubmission.findFirst({
    where: await scopedAuditByIdWhere(session, id),
    select: { feedbackSecurity: true, feedbackDate: true },
  });
  if (!existing) {
    return { error: "Audit not found." };
  }

  return updateAuditFeedback(id, {
    feedbackSecurity: parseFeedbackSecurity(existing.feedbackSecurity),
    feedbackStatus,
    feedbackDate: existing.feedbackDate ?? "",
    feedbackStatusAt: "",
  });
}

export async function getDashboardAuditData(): Promise<DashboardAuditData> {
  const session = await requirePermission(PERMISSIONS.OVERVIEW_READ);

  try {
    const cacheScope = cacheScopeFromSession(session);
    const submissions = await withDbRetry(() =>
      getCachedDashboardRecords(cacheScope)()
    );

    return {
      records: submissions.map((s) => ({
        id: s.id,
        auditCode: s.auditCode,
        agent: s.agent,
        supervisor: s.supervisor,
        auditor: s.auditor,
        lob: s.lob,
        type: s.type,
        callDate: s.callDate,
        auditDate: s.auditDate,
        qualityPct: s.qualityPct,
        finalPct: s.finalPct,
        hasFatal: s.hasFatal,
        fatalList: parseFatalList(s.fatalList),
      })),
      fetchedAt: new Date().toISOString(),
      dbError: null as string | null,
    };
  } catch (error) {
    console.error("getDashboardAuditData failed:", error);
    return {
      records: [],
      fetchedAt: new Date().toISOString(),
      dbError:
        "Unable to reach the database. Use the Supabase session pooler (pooler.supabase.com:5432) in DATABASE_URL or DATABASE_URL_SESSION — not db.*.supabase.co.",
    };
  }
}

export async function previewAuditScore(
  formData: AuditFormData,
  scores: ScoresMap,
  templateId: string
) {
  await requirePermission(PERMISSIONS.AUDIT_FORM_READ);
  const template = await getTemplateById(templateId);
  if (!template) {
    return { ok: false as const, error: "Audit template not found." };
  }
  return calculateResults(formData, scores, template);
}
