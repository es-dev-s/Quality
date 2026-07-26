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
import { loadImportEntityCatalog } from "@/lib/import/resolve-import-entities";
import { validateImportEntities } from "@/lib/import/import-entity-catalog";
import { importRowIntegrityError } from "@/lib/import/import-row-guards";
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
    auditor: z.string().min(1),
    type: z.enum(["Call", "Chat"]),
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
  qualityPct: z.number().finite().min(0).max(100),
  finalPct: z.number().finite().min(0).max(100),
  grade: z.string().min(1),
  hasFatal: z.boolean(),
  fatalList: z.array(z.string()),
  totalScored: z.number().finite().min(0),
  totalMax: z.number().finite().min(0),
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

  // Drop anything that somehow arrived blank; never write fabricated rows.
  const nonEmptyRows = rows.filter((row) => {
    const agent = row.formData?.agent?.trim() ?? "";
    const auditor = row.formData?.auditor?.trim() ?? "";
    const hasDates =
      Boolean(row.formData?.callDate?.trim()) ||
      Boolean(row.formData?.auditDate?.trim());
    const hasScores =
      Object.keys(row.scores ?? {}).length > 0 ||
      (row.auditRows ?? []).some((entry) => entry.sel?.trim()) ||
      (row.totalMax ?? 0) > 0;
    return Boolean(agent || auditor || hasDates || hasScores);
  });

  if (nonEmptyRows.length === 0) {
    return { error: "No audits to import (empty rows were ignored)." };
  }

  // Structural + integrity validation — reject the whole batch if any row is bad.
  const structurallyValid: ParsedAuditImportRow[] = [];
  for (const row of nonEmptyRows) {
    const integrityError = importRowIntegrityError(row);
    if (integrityError) {
      return {
        error: `Import blocked — row ${row.rowNumber}: ${integrityError}`,
      };
    }

    const parsedRow = importRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return {
        error: `Import blocked — row ${row.rowNumber} is invalid (${
          parsedRow.error.issues[0]?.message ?? "schema error"
        }).`,
      };
    }
    if (!row.templateId) {
      return {
        error: `Import blocked — row ${row.rowNumber} has no matched audit template.`,
      };
    }
    structurallyValid.push(row);
  }

  // Entity integrity — Agent (user or roster) + Quality Auditor (audit-capable user).
  // Team Name is free text.
  const catalog = await loadImportEntityCatalog();
  const entityValidation = validateImportEntities(
    structurallyValid.map((row) => ({
      rowNumber: row.rowNumber,
      agent: row.formData.agent,
      auditor: row.formData.auditor,
      teamName: row.formData.supervisor,
    })),
    catalog
  );

  if (!entityValidation.ok) {
    return { error: entityValidation.summary };
  }

  const skipExisting = parsedOptions.data.skipExisting ?? true;
  const result: AuditImportResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of structurallyValid) {
    const resolved = entityValidation.resolved.get(row.rowNumber);
    if (!resolved) {
      return {
        error: `Import blocked — could not resolve entities for row ${row.rowNumber}.`,
      };
    }

    // Canonical names from DB so tables/analytics match live form data.
    const normalizedRow: ParsedAuditImportRow = {
      ...row,
      formData: {
        ...row.formData,
        agent: resolved.agentName,
        auditor: resolved.auditorName,
        supervisor: resolved.teamName,
      },
      feedback: {
        ...row.feedback,
        agentFeedback: row.feedback.agentFeedback,
      },
    };

    const existing = await prisma.auditSubmission.findUnique({
      where: { auditCode: normalizedRow.auditCode },
      select: { id: true },
    });

    if (existing) {
      if (skipExisting) {
        result.skipped += 1;
        result.errors.push({
          row: normalizedRow.rowNumber,
          auditCode: normalizedRow.auditCode,
          message: "Audit ID already exists.",
        });
        continue;
      }
    }

    const record = buildAuditRecord(normalizedRow);
    const createdAt = normalizedRow.submittedAt
      ? new Date(normalizedRow.submittedAt)
      : undefined;

    try {
      await prisma.auditSubmission.create({
        data: {
          auditCode: normalizedRow.auditCode,
          templateId: normalizedRow.templateId,
          submittedById: session.user.id,
          agent: normalizedRow.formData.agent,
          supervisor: normalizedRow.formData.supervisor || null,
          auditor: normalizedRow.formData.auditor || null,
          type: normalizedRow.formData.type,
          businessType: normalizedRow.formData.businessType || "",
          callDate:
            normalizedRow.formData.callDate || normalizedRow.formData.auditDate,
          auditDate:
            normalizedRow.formData.auditDate || normalizedRow.formData.callDate,
          lob: normalizedRow.formData.lob || "",
          sublob: normalizedRow.formData.sublob || null,
          reason: normalizedRow.formData.reason || null,
          mobile: normalizedRow.formData.mobile || null,
          referenceUrl: normalizedRow.formData.referenceUrl || null,
          response: normalizedRow.formData.response || null,
          qualityPct: normalizedRow.qualityPct,
          finalPct: normalizedRow.finalPct,
          grade: normalizedRow.grade,
          hasFatal: normalizedRow.hasFatal,
          fatalList: normalizedRow.fatalList,
          feedbackStatus: normalizedRow.feedback.feedbackStatus,
          feedbackSecurity: normalizedRow.feedback.feedbackSecurity,
          feedbackDate: normalizedRow.feedback.feedbackDate || null,
          feedbackStatusAt: normalizedRow.feedback.feedbackStatusAt || null,
          agentFeedback: normalizedRow.feedback.agentFeedback,
          supervisorRemarks: normalizedRow.feedback.supervisorRemarks,
          totalScored: normalizedRow.totalScored,
          totalMax: normalizedRow.totalMax,
          scores: normalizedRow.scores,
          catScores: normalizedRow.catScores,
          rows: normalizedRow.auditRows,
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
          row: normalizedRow.rowNumber,
          auditCode: normalizedRow.auditCode,
          message: "Audit ID already exists.",
        });
        continue;
      }

      // Hard stop on unexpected write failures so partial bad state is visible.
      return {
        error: `Import stopped at row ${normalizedRow.rowNumber}: ${
          error instanceof Error ? error.message : "Could not create audit."
        }. ${result.created} row(s) were created before this failure.`,
      };
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
  const [rows, entityCatalog] = await Promise.all([
    prisma.formTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    loadImportEntityCatalog(),
  ]);

  return {
    templates: rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
    })),
    templateBodies: Object.fromEntries(
      rows.map((row) => [row.id, rowToAuditTemplate(row)])
    ),
    entityCatalog,
  };
}
