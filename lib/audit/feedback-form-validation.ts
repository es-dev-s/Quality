import type { AuditFormData } from "@/lib/audit/types";

export function validateFeedbackSection(
  formData: Pick<AuditFormData, "feedbackSecurity" | "agentFeedback">
):
  | { ok: true }
  | { ok: false; fieldIds: string[] } {
  const fieldIds: string[] = [];

  if (formData.feedbackSecurity === "NA") {
    fieldIds.push("feedbackSecurity");
  }

  if (!formData.agentFeedback.trim()) {
    fieldIds.push("agentFeedback");
  }

  if (fieldIds.length === 0) {
    return { ok: true };
  }

  return { ok: false, fieldIds };
}
