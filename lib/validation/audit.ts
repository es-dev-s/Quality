import { z } from "zod";
import {
  FEEDBACK_SECURITY_OPTIONS,
  FEEDBACK_STATUS_OPTIONS,
} from "@/lib/audit/feedback";
import { cuidSchema, submissionKeySchema } from "@/lib/validation/common";

const scoreValueSchema = z.string().trim().max(32);

export const scoresMapSchema = z.record(z.string(), scoreValueSchema);

export const auditFormDataSchema = z
  .object({
    agent: z.string(),
    supervisor: z.string(),
    auditor: z.string(),
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
    feedbackSecurity: z
      .enum(FEEDBACK_SECURITY_OPTIONS)
      .refine((value) => value !== "NA", {
        message: "Select a severity level.",
      }),
    feedbackStatus: z.enum(FEEDBACK_STATUS_OPTIONS),
    feedbackDate: z.string(),
    agentFeedback: z
      .string()
      .trim()
      .min(1, "Feedback for the agent is required."),
  });

export const saveAuditSubmissionSchema = z.object({
  formData: auditFormDataSchema,
  scores: scoresMapSchema,
  templateId: z.string().trim().min(1),
  submissionKey: submissionKeySchema.optional(),
});

export const updateAuditSubmissionSchema = z.object({
  id: cuidSchema,
  formData: auditFormDataSchema,
  scores: scoresMapSchema,
  templateId: z.string().trim().min(1),
});

export const updateAuditFeedbackSchema = z.object({
  id: cuidSchema,
  feedbackSecurity: z.enum(FEEDBACK_SECURITY_OPTIONS),
  feedbackStatus: z.enum(FEEDBACK_STATUS_OPTIONS),
  feedbackDate: z.string(),
  feedbackStatusAt: z.string().optional(),
});

export const auditIdSchema = z.object({
  id: cuidSchema,
});

export const updateSupervisorRemarksSchema = z.object({
  id: cuidSchema,
  supervisorRemarks: z.string().trim().max(4000),
});

export const deleteAuditSubmissionsSchema = z.object({
  ids: z.array(cuidSchema).min(1, "Select at least one audit.").max(100),
});

export const exportAuditSubmissionsSchema = z.object({
  ids: z
    .array(cuidSchema)
    .min(1, "Select at least one audit to export.")
    .max(500),
});

export type ValidatedAuditFormData = z.infer<typeof auditFormDataSchema>;
export type ValidatedScoresMap = z.infer<typeof scoresMapSchema>;
