import {
  normalizeFeedbackForSave,
  parseFeedbackSecurity,
  parseFeedbackStatus,
  validateFeedbackForSave,
  type AuditFeedbackFields,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import { resolveStatusTimestamps } from "@/lib/audit/feedback-datetime";
import {
  assertFeedbackStatusChangeAllowed,
  canChangeFeedbackStatusInAuditLogs,
} from "@/lib/audit/feedback-status-access";
import type { MemberFeedbackMode } from "@/lib/audit/member-access";
import { canEditFeedbackFully, canWriteAuditForm, type SessionRole } from "@/lib/rbac";

export function applyFormFeedbackStatusChange(
  current: { feedbackStatus: FeedbackStatus; feedbackDate: string },
  next: FeedbackStatus
): { feedbackStatus: FeedbackStatus; feedbackDate: string } {
  if (next === "Pending") {
    return { feedbackStatus: next, feedbackDate: "" };
  }

  if (next === "Shared") {
    return {
      feedbackStatus: next,
      feedbackDate: current.feedbackDate.trim() || new Date().toISOString(),
    };
  }

  return {
    feedbackStatus: next,
    feedbackDate: current.feedbackDate,
  };
}

export function resolveFormFeedbackForSave(input: {
  role: SessionRole;
  memberMode?: MemberFeedbackMode;
  requested: {
    feedbackSecurity: unknown;
    feedbackStatus: unknown;
    feedbackDate?: string;
  };
  existing?: {
    feedbackStatus?: string | null;
    feedbackDate: string | null;
    feedbackStatusAt: string | null;
  };
}): AuditFeedbackFields | { error: string } {
  const previousStatus = input.existing
    ? parseFeedbackStatus(input.existing.feedbackStatus)
    : "Pending";
  const requestedStatus = parseFeedbackStatus(input.requested.feedbackStatus);
  const canChange =
    canWriteAuditForm(input.role) ||
    canEditFeedbackFully(input.role) ||
    canChangeFeedbackStatusInAuditLogs(input.role);

  const nextStatus = canChange ? requestedStatus : previousStatus;

  if (canChange && nextStatus !== previousStatus && !canEditFeedbackFully(input.role)) {
    if (canWriteAuditForm(input.role) && !canChangeFeedbackStatusInAuditLogs(input.role)) {
      if (previousStatus === "Acknowledged") {
        return { error: "Acknowledged status cannot be changed after the agent responds." };
      }
      if (!["Pending", "Shared"].includes(nextStatus)) {
        return { error: "This form can only set Pending or Shared." };
      }
    } else {
      const statusError = assertFeedbackStatusChangeAllowed(
        input.role,
        previousStatus,
        nextStatus,
        input.memberMode
      );
      if (statusError) {
        return { error: statusError };
      }
    }
  }

  const timestamps = resolveStatusTimestamps({
    feedbackStatus: nextStatus,
    feedbackDate: input.requested.feedbackDate ?? "",
    feedbackStatusAt: input.existing?.feedbackStatusAt ?? "",
    previousStatus,
    existingFeedbackDate: input.existing?.feedbackDate ?? null,
    existingFeedbackStatusAt: input.existing?.feedbackStatusAt ?? null,
  });

  const normalized = normalizeFeedbackForSave({
    feedbackSecurity: parseFeedbackSecurity(input.requested.feedbackSecurity),
    feedbackStatus: nextStatus,
    feedbackDate: timestamps.feedbackDate ?? "",
    feedbackStatusAt: timestamps.feedbackStatusAt ?? "",
  });

  const validationErrorMessage = validateFeedbackForSave(normalized);
  if (validationErrorMessage) {
    return { error: validationErrorMessage };
  }

  return normalized;
}
