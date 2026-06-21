import {
  localDateTimeToIso,
  nowLocalDateTime,
} from "@/lib/audit/feedback-datetime";

export type FeedbackSecurity = "Low" | "Medium" | "Critical" | "NA";

export type FeedbackStatus =
  | "Pending"
  | "Shared"
  | "Acknowledged"
  | "Disputed";

export const FEEDBACK_SECURITY_OPTIONS: FeedbackSecurity[] = [
  "Low",
  "Medium",
  "Critical",
  "NA",
];

export const FEEDBACK_STATUS_OPTIONS: FeedbackStatus[] = [
  "Pending",
  "Shared",
  "Acknowledged",
  "Disputed",
];

/** User-facing label for feedbackSecurity (issue severity level). */
export const FEEDBACK_SEVERITY_LABEL = "Severity";

export type AuditFeedbackFields = {
  feedbackSecurity: FeedbackSecurity;
  feedbackStatus: FeedbackStatus;
  /** ISO or YYYY-MM-DD — when feedback was shared. */
  feedbackDate: string;
  /** ISO datetime when agent acknowledged or disputed. */
  feedbackStatusAt?: string;
};

export function defaultAuditFeedback(): AuditFeedbackFields {
  return {
    feedbackSecurity: "NA",
    feedbackStatus: "Pending",
    feedbackDate: "",
    feedbackStatusAt: "",
  };
}

export function parseFeedbackSecurity(value: unknown): FeedbackSecurity {
  if (
    value === "Low" ||
    value === "Medium" ||
    value === "Critical" ||
    value === "NA"
  ) {
    return value;
  }
  return "NA";
}

export function parseFeedbackStatus(value: unknown): FeedbackStatus {
  if (typeof value !== "string") return "Pending";
  const normalized = value.trim();
  const match = FEEDBACK_STATUS_OPTIONS.find(
    (status) => status.toLowerCase() === normalized.toLowerCase()
  );
  return match ?? "Pending";
}

/** Normalize feedback before save — auto-set timestamps when status moves off Pending. */
export function normalizeFeedbackForSave(
  feedback: AuditFeedbackFields
): AuditFeedbackFields {
  const feedbackStatus = parseFeedbackStatus(feedback.feedbackStatus);
  const feedbackSecurity = parseFeedbackSecurity(feedback.feedbackSecurity);
  let feedbackDate = feedback.feedbackDate.trim();
  let feedbackStatusAt = feedback.feedbackStatusAt?.trim() ?? "";

  if (feedbackStatus === "Pending") {
    return {
      feedbackSecurity,
      feedbackStatus,
      feedbackDate: "",
      feedbackStatusAt: "",
    };
  }

  if (feedbackStatus === "Shared" && !feedbackDate) {
    feedbackDate = localDateTimeToIso(nowLocalDateTime()) || nowLocalDateTime();
  }

  if (
    (feedbackStatus === "Acknowledged" || feedbackStatus === "Disputed") &&
    !feedbackStatusAt
  ) {
    feedbackStatusAt = new Date().toISOString();
  }

  if (feedbackDate) {
    feedbackDate = localDateTimeToIso(feedbackDate) || feedbackDate;
  }

  if (feedbackStatusAt) {
    feedbackStatusAt =
      localDateTimeToIso(feedbackStatusAt) || feedbackStatusAt;
  }

  return {
    feedbackSecurity,
    feedbackStatus,
    feedbackDate,
    feedbackStatusAt,
  };
}

export function validateFeedbackForSave(
  feedback: AuditFeedbackFields
): string | null {
  const normalized = normalizeFeedbackForSave(feedback);
  const status = normalized.feedbackStatus;

  if (status === "Pending") return null;

  if (status === "Shared" && !normalized.feedbackDate) {
    return "Feedback date & time is required when status is Shared.";
  }

  if (
    (status === "Acknowledged" || status === "Disputed") &&
    !normalized.feedbackStatusAt
  ) {
    return `${status} date & time is required.`;
  }

  return null;
}
