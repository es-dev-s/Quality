import type { AuditFormData } from "@/lib/audit/types";
import {
  FEEDBACK_STATUS_OPTIONS,
  parseFeedbackStatus,
} from "@/lib/audit/feedback";

export function validateFeedbackSection(
  formData: Pick<
    AuditFormData,
    "feedbackSecurity" | "feedbackStatus" | "agentFeedback"
  >
):
  | { ok: true }
  | { ok: false; fieldIds: string[] } {
  const fieldIds: string[] = [];

  if (formData.feedbackSecurity === "NA") {
    fieldIds.push("feedbackSecurity");
  }

  const status = parseFeedbackStatus(formData.feedbackStatus);
  if (!formData.feedbackStatus.trim() || !FEEDBACK_STATUS_OPTIONS.includes(status)) {
    fieldIds.push("feedbackStatus");
  }

  if (!formData.agentFeedback.trim()) {
    fieldIds.push("agentFeedback");
  }

  if (fieldIds.length === 0) {
    return { ok: true };
  }

  return { ok: false, fieldIds };
}
