"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { IMPORT_ENABLED } from "@/lib/constants";
import { rowToAuditTemplate } from "@/lib/audit/template-db";
import type { AuditRecord } from "@/lib/audit/types";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { invalidateAuditCaches } from "@/lib/invalidate-cache";
import type {
  AuditImportResult,
  ParsedAuditImportRow,
} from "@/lib/import/audit-import-types";
import { prisma } from "@/lib/prisma";

const importOptionsSchema = z.object({
  skipExisting: z.boolean().optional(),
});

const importRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  auditCode: z.string().min(1),
  templateId: z.string().min(1),
  formData: z.object({
    agent: z.string().min(1),
    supervisor: z.string(),
    auditor: z.string(),
    type: z.string().min(1),
    businessType: z.string(),
    callDate: z.string(),
    auditDate: z.string(),
    lob: z.string(),
    sublob: z.string(),
    mobile: z.string(),
    referenceUrl: z.string(),
    reason: z.string(),
    subReason: z.string(),
    response: z.string(),
    feedbackSecurity: z.string(),
    feedbackStatus: z.string(),
    feedbackDate: z.string(),
    agentFeedback: z.string(),
  }),
  qualityPct: z.number(),
  finalPct: z.number(),
  grade: z.string(),
  hasFatal: z.boolean(),
  fatalList: z.array(z.string()),
  totalScored: z.number(),
  totalMax: z.number(),
  catScores: z.record(
    z.string(),
    z.object({
      scored: z.number(),
      max: z.number(),
    })
  ),
  auditRows: z.array(
    z.object({
      id: z.string(),
      cat: z.string(),
      name: z.string(),
      max: z.number(),
      sel: z.string(),
      score: z.number(),
      fatal: z.boolean(),
    })
  ),
  scores: z.record(z.string(), z.string()),
  feedback: z.object({
    feedbackSecurity: z.string(),
    feedbackStatus: z.string(),
    feedbackDate: z.string(),
    feedbackStatusAt: z.string().optional(),
    agentFeedback: z.string(),
    supervisorRemarks: z.string(),
  }),
  submittedAt: z.string().nullable().optional(),
});

function buildAuditRecord(row: ParsedAuditImportRow): AuditRecord {
  const { formData, feedback } = row;
  return {
    ...formData,
    id: row.auditCode,
    savedAt: row.submittedAt ?? new Date().toISOString(),
    qualityPct: row.qualityPct,
    finalPct: row.finalPct,
    grade: row.grade,
    gc: row.hasFatal ? "red" : row.qualityPct >= 75 ? "green" : "amber",
    qualityGrade: row.grade,
    qualityGc: row.qualityPct >= 75 ? "green" : "amber",
    hasFatal: row.hasFatal,
    fatalList: row.fatalList,
    feedbackSecurity: feedback.feedbackSecurity,
    feedbackStatus: feedback.feedbackStatus,
    feedbackDate: feedback.feedbackDate,
    totalScored: row.totalScored,
    totalMax: row.totalMax,
    catScores: row.catScores,
    rows: row.auditRows,
  };
}

export async function importAuditSubmissions(
  rows: ParsedAuditImportRow[],
  options: { skipExisting?: boolean } = {}
): Promise<AuditImportResult | { error: string }> {
  if (!IMPORT_ENABLED) {
    return { error: "Import is not available." };
  }

  const session = await requireSuperAdmin();
  const parsedOptions = importOptionsSchema.safeParse(options);
  if (!parsedOptions.success) {
    return { error: "Invalid import options." };
  }

  if (rows.length === 0) {
    return { error: "No audits to import." };
  }

  if (rows.length > 500) {
    return { error: "Import up to 500 audits at a time." };
  }

  const skipExisting = parsedOptions.data.skipExisting ?? true;
  const result: AuditImportResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    const parsedRow = importRowSchema.safeParse(row);
    if (!parsedRow.success) {
      result.errors.push({
        row: row.rowNumber,
        auditCode: row.auditCode || `Row ${row.rowNumber}`,
        message: parsedRow.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }

    if (row.errors.length > 0) {
      result.errors.push({
        row: row.rowNumber,
        auditCode: row.auditCode,
        message: row.errors.join(" "),
      });
      continue;
    }

    const existing = await prisma.auditSubmission.findUnique({
      where: { auditCode: row.auditCode },
      select: { id: true },
    });

    if (existing) {
      if (skipExisting) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          auditCode: row.auditCode,
          message: "Audit ID already exists.",
        });
        continue;
      }
    }

    const record = buildAuditRecord(row);
    const createdAt = row.submittedAt ? new Date(row.submittedAt) : undefined;

    try {
      await prisma.auditSubmission.create({
        data: {
          auditCode: row.auditCode,
          templateId: row.templateId,
          submittedById: session.user.id,
          agent: row.formData.agent,
          supervisor: row.formData.supervisor || null,
          auditor: row.formData.auditor || null,
          type: row.formData.type,
          businessType: row.formData.businessType || "",
          callDate: row.formData.callDate || row.formData.auditDate,
          auditDate: row.formData.auditDate || row.formData.callDate,
          lob: row.formData.lob || "",
          sublob: row.formData.sublob || null,
          reason: row.formData.reason || null,
          mobile: row.formData.mobile || null,
          referenceUrl: row.formData.referenceUrl || null,
          response: row.formData.response || null,
          qualityPct: row.qualityPct,
          finalPct: row.finalPct,
          grade: row.grade,
          hasFatal: row.hasFatal,
          fatalList: row.fatalList,
          feedbackStatus: row.feedback.feedbackStatus,
          feedbackSecurity: row.feedback.feedbackSecurity,
          feedbackDate: row.feedback.feedbackDate || null,
          feedbackStatusAt: row.feedback.feedbackStatusAt || null,
          agentFeedback: row.feedback.agentFeedback,
          supervisorRemarks: row.feedback.supervisorRemarks,
          totalScored: row.totalScored,
          totalMax: row.totalMax,
          scores: row.scores,
          catScores: row.catScores,
          rows: row.auditRows,
          record: record as unknown as object,
          ...(createdAt && !Number.isNaN(createdAt.getTime())
            ? { createdAt }
            : {}),
        },
      });
      result.created += 1;
    } catch (error) {
      if (isPrismaUniqueViolation(error, "auditCode")) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          auditCode: row.auditCode,
          message: "Audit ID already exists.",
        });
        continue;
      }

      result.errors.push({
        row: row.rowNumber,
        auditCode: row.auditCode,
        message:
          error instanceof Error ? error.message : "Could not create audit.",
      });
    }
  }

  if (result.created > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/audit-logs");
    revalidatePath("/analytics");
    revalidatePath("/reports");
    revalidatePath("/import");
    invalidateAuditCaches(session.user.id, {
      type: "audit:created",
      auditId: "import",
      submittedById: session.user.id,
    });
  }

  return result;
}

export async function getAuditImportContext() {
  await requireSuperAdmin();
  const rows = await prisma.formTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return {
    templates: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
    })),
    templateBodies: Object.fromEntries(
      rows.map((row) => [row.id, rowToAuditTemplate(row)])
    ),
  };
}
