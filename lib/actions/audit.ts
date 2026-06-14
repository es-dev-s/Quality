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
import { canEditFeedbackFully, hasScope } from "@/lib/rbac";
import { scopedAuditByIdWhere, scopedAuditWhere } from "@/lib/audit/scoped-audit-query";
import { mergeAuditorOptions } from "@/lib/audit/auditors";
import { calculateResults } from "@/lib/audit/calculate-results";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { fetchActiveAgentNames } from "@/lib/audit/agent-db";
import { getLobDffOptions } from "@/lib/audit/interaction-options";
import { validateAuditFormAgainstConfig } from "@/lib/audit/validate-audit-form-config";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { getTemplateById } from "@/lib/actions/templates";
import { withDbRetry } from "@/lib/db/with-db-retry";
import {
  defaultAuditFeedback,
  normalizeFeedbackForSave,
  parseFeedbackSecurity,
  parseFeedbackStatus,
  validateFeedbackForSave,
  type FeedbackSecurity,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import type {
  AuditDetail,
  AuditEditPayload,
  AuditLogEntry,
  DashboardAuditData,
} from "@/lib/audit/audit-records";
import type {
  AuditFormData,
  AuditRow,
  CategoryScore,
  ScoresMap,
} from "@/lib/audit/types";

export async function getAuditors() {
  await requirePermission(PERMISSIONS.AUDIT_FORM_READ);
  const [config, users] = await Promise.all([
    getInteractionConfig(),
    prisma.user.findMany({
      select: { name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return mergeAuditorOptions(config, users);
}

export async function saveAuditSubmission(
  formData: AuditFormData,
  scores: ScoresMap,
  templateId: string
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_WRITE);
  const template = await getTemplateById(templateId);
  if (!template) {
    return { error: "Audit template not found." };
  }

  const [interactionConfig, agentNames, users] = await Promise.all([
    getInteractionConfig(),
    fetchActiveAgentNames(),
    prisma.user.findMany({
      select: { name: true, email: true },
    }),
  ]);
  const configError = validateAuditFormAgainstConfig(formData, {
    ...interactionConfig,
    agents: agentNames,
  }, users);
  if (configError) {
    return { error: configError };
  }

  const feedbackError = validateFeedbackForSave({
    feedbackSecurity: formData.feedbackSecurity,
    feedbackStatus: formData.feedbackStatus,
    feedbackDate: formData.feedbackDate,
  });
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave({
    feedbackSecurity: formData.feedbackSecurity,
    feedbackStatus: formData.feedbackStatus,
    feedbackDate: formData.feedbackDate,
  });

  const matchedLob = interactionConfig.lobs.find(
    (lob) =>
      lob.name === formData.lob && lob.businessType === formData.businessType
  );
  const subReasonOptions = getLobDffOptions(matchedLob);

  const result = calculateResults(formData, scores, template, feedback, {
    subReasonRequired: subReasonOptions.length > 0,
  });

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
    mobile: record.mobile || null,
    response: record.response || null,
    qualityPct: record.qualityPct,
    finalPct: record.finalPct,
    grade: record.grade,
    hasFatal: record.hasFatal,
    fatalList: record.fatalList,
    feedbackStatus: feedback.feedbackStatus,
    feedbackSecurity: feedback.feedbackSecurity,
    feedbackDate: feedback.feedbackDate || null,
    agentFeedback: formData.agentFeedback.trim(),
    totalScored: record.totalScored,
    totalMax: record.totalMax,
    scores,
    catScores: record.catScores,
    rows: record.rows,
    record: record as unknown as object,
  };

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prisma.auditSubmission.create({ data: submissionData });
        break;
      } catch (error) {
        if (isPrismaUniqueViolation(error, "auditCode") && attempt < 2) {
          const retry = calculateResults(formData, scores, template, feedback, {
            subReasonRequired: subReasonOptions.length > 0,
          });
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

function mapAuditSubmission(
  s: Awaited<ReturnType<typeof fetchRecentAuditSubmissions>>[number]
): AuditLogEntry {
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
    agentFeedback: s.agentFeedback ?? "",
    submittedBy: s.submittedBy.name ?? s.submittedBy.email,
    createdAt: s.createdAt.toISOString(),
  };
}

async function fetchRecentAuditSubmissions(
  where: Prisma.AuditSubmissionWhereInput,
  take = 500
) {
  return prisma.auditSubmission.findMany({
    where,
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getAuditLogs(limit = 500) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);

  const submissions = await fetchRecentAuditSubmissions(
    scopedAuditWhere(session),
    limit
  );

  return {
    total: submissions.length,
    submissions: submissions.map(mapAuditSubmission),
  };
}

export async function getAuditDetail(id: string) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);

  const submission = await prisma.auditSubmission.findFirst({
    where: scopedAuditByIdWhere(session, id),
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
  });

  if (!submission) return null;

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
    mobile: submission.mobile,
    response: submission.response,
    qualityPct: submission.qualityPct,
    finalPct: submission.finalPct,
    grade: submission.grade,
    hasFatal: submission.hasFatal,
    fatalList: parseFatalList(submission.fatalList),
    feedbackSecurity: parseFeedbackSecurity(submission.feedbackSecurity),
    feedbackStatus: parseFeedbackStatus(submission.feedbackStatus),
    feedbackDate: submission.feedbackDate,
    agentFeedback: submission.agentFeedback ?? "",
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

  const record = submission.record as { subReason?: unknown } | null;
  const subReason =
    typeof record?.subReason === "string" ? record.subReason : "";

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
    mobile: submission.mobile ?? "",
    reason: submission.reason ?? "",
    subReason,
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
    where: scopedAuditByIdWhere(session, id),
    include: {
      submittedBy: { select: { name: true, email: true } },
    },
  });
}

export async function getAuditForEdit(id: string): Promise<AuditEditPayload | null> {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_WRITE);

  const submission = await fetchAuditSubmissionById(session, id);
  if (!submission) return null;

  const templateId = resolveSubmissionTemplateId(
    submission.templateId,
    submission.type
  );
  const template = await getTemplateById(templateId);
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

  const existing = await prisma.auditSubmission.findFirst({
    where: scopedAuditByIdWhere(session, id),
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

  const template = await getTemplateById(templateId);
  if (!template) {
    return { error: "Audit template not found." };
  }

  const [interactionConfig, agentNames, users] = await Promise.all([
    getInteractionConfig(),
    fetchActiveAgentNames(),
    prisma.user.findMany({
      select: { name: true, email: true },
    }),
  ]);
  const configError = validateAuditFormAgainstConfig(formData, {
    ...interactionConfig,
    agents: agentNames,
  }, users);
  if (configError) {
    return { error: configError };
  }

  const feedbackError = validateFeedbackForSave({
    feedbackSecurity: formData.feedbackSecurity,
    feedbackStatus: formData.feedbackStatus,
    feedbackDate: formData.feedbackDate,
  });
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave({
    feedbackSecurity: formData.feedbackSecurity,
    feedbackStatus: formData.feedbackStatus,
    feedbackDate: formData.feedbackDate,
  });

  const matchedLob = interactionConfig.lobs.find(
    (lob) =>
      lob.name === formData.lob && lob.businessType === formData.businessType
  );
  const subReasonOptions = getLobDffOptions(matchedLob);

  const result = calculateResults(
    formData,
    scores,
    template,
    {
      id: existing.auditCode,
      ...feedback,
    },
    { subReasonRequired: subReasonOptions.length > 0 }
  );

  if (!result.ok) {
    return { error: result.error };
  }

  const record = result.record;

  try {
    await prisma.auditSubmission.update({
      where: { id },
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
        mobile: record.mobile || null,
        response: record.response || null,
        qualityPct: record.qualityPct,
        finalPct: record.finalPct,
        grade: record.grade,
        hasFatal: record.hasFatal,
        fatalList: record.fatalList,
        feedbackStatus: feedback.feedbackStatus,
        feedbackSecurity: feedback.feedbackSecurity,
        feedbackDate: feedback.feedbackDate || null,
        agentFeedback: formData.agentFeedback.trim(),
        totalScored: record.totalScored,
        totalMax: record.totalMax,
        scores,
        catScores: record.catScores,
        rows: record.rows,
        record: record as unknown as object,
      },
    });
  } catch (error) {
    console.error("updateAuditSubmission failed:", error);
    return {
      error: "Could not save changes to this audit. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/audit-logs");
  revalidatePath(`/audit-logs/${id}/edit`);
  revalidatePath("/analytics");
  revalidatePath("/reports");
  revalidatePath("/forms");
  revalidatePath("/forms/audit");

  return { success: true, record };
}

export async function updateAuditFeedback(
  id: string,
  data: {
    feedbackSecurity: FeedbackSecurity;
    feedbackStatus: FeedbackStatus;
    feedbackDate: string;
  }
) {
  const session = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  if (!hasScope(session.user.role, PERMISSIONS.FEEDBACK_STATUS) &&
      !hasScope(session.user.role, PERMISSIONS.FEEDBACK_WRITE)) {
    return permissionError();
  }

  const existing = await prisma.auditSubmission.findFirst({
    where: scopedAuditByIdWhere(session, id),
    select: {
      id: true,
      feedbackSecurity: true,
      feedbackDate: true,
    },
  });
  if (!existing) {
    return { error: "Audit not found." };
  }

  const canEditAllFeedback = canEditFeedbackFully(session.user.role);
  const payload = canEditAllFeedback
    ? data
    : {
        feedbackSecurity: parseFeedbackSecurity(existing.feedbackSecurity),
        feedbackStatus: data.feedbackStatus,
        feedbackDate: data.feedbackDate,
      };

  const feedbackError = validateFeedbackForSave(payload);
  if (feedbackError) {
    return { error: feedbackError };
  }

  const feedback = normalizeFeedbackForSave(payload);

  await prisma.auditSubmission.update({
    where: { id: existing.id },
    data: {
      feedbackSecurity: feedback.feedbackSecurity,
      feedbackStatus: feedback.feedbackStatus,
      feedbackDate: feedback.feedbackDate || null,
    },
  });

  revalidatePath("/audit-logs");
  revalidatePath("/analytics");
  revalidatePath("/reports");

  return { success: true as const };
}

/** @deprecated Use updateAuditFeedback */
export async function updateAuditFeedbackStatus(
  id: string,
  feedbackStatus: FeedbackStatus
) {
  const existing = await prisma.auditSubmission.findUnique({
    where: { id },
    select: { feedbackSecurity: true, feedbackDate: true },
  });
  if (!existing) {
    return { error: "Audit not found." };
  }

  return updateAuditFeedback(id, {
    feedbackSecurity: parseFeedbackSecurity(existing.feedbackSecurity),
    feedbackStatus,
    feedbackDate: existing.feedbackDate ?? "",
  });
}

async function fetchDashboardAuditRecords(
  where: Prisma.AuditSubmissionWhereInput
) {
  return prisma.auditSubmission.findMany({
    where,
    select: {
      id: true,
      agent: true,
      supervisor: true,
      auditor: true,
      lob: true,
      type: true,
      callDate: true,
      qualityPct: true,
      finalPct: true,
      hasFatal: true,
      fatalList: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDashboardAuditData(): Promise<DashboardAuditData> {
  const session = await requirePermission(PERMISSIONS.OVERVIEW_READ);

  try {
    const submissions = await withDbRetry(() =>
      fetchDashboardAuditRecords(scopedAuditWhere(session))
    );

    return {
      records: submissions.map((s) => ({
        id: s.id,
        agent: s.agent,
        supervisor: s.supervisor,
        auditor: s.auditor,
        lob: s.lob,
        type: s.type,
        callDate: s.callDate,
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
