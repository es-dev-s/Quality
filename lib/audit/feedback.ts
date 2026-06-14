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

export type AuditFeedbackFields = {
  feedbackSecurity: FeedbackSecurity;
  feedbackStatus: FeedbackStatus;
  /** ISO date (YYYY-MM-DD) when feedback was shared; empty while pending. */
  feedbackDate: string;
};

export function defaultAuditFeedback(): AuditFeedbackFields {
  return {
    feedbackSecurity: "NA",
    feedbackStatus: "Pending",
    feedbackDate: "",
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
  if (
    value === "Pending" ||
    value === "Shared" ||
    value === "Acknowledged" ||
    value === "Disputed"
  ) {
    return value;
  }
  return "Pending";
}

/** Normalize feedback before save — auto-set date when status moves off Pending. */
export function normalizeFeedbackForSave(
  feedback: AuditFeedbackFields,
  todayISO: () => string = () => new Date().toISOString().slice(0, 10)
): AuditFeedbackFields {
  const feedbackStatus = parseFeedbackStatus(feedback.feedbackStatus);
  const feedbackSecurity = parseFeedbackSecurity(feedback.feedbackSecurity);
  let feedbackDate = feedback.feedbackDate.trim();

  if (feedbackStatus === "Pending") {
    return {
      feedbackSecurity,
      feedbackStatus,
      feedbackDate: "",
    };
  }

  if (!feedbackDate) {
    feedbackDate = todayISO();
  }

  return {
    feedbackSecurity,
    feedbackStatus,
    feedbackDate,
  };
}

export function validateFeedbackForSave(feedback: AuditFeedbackFields): string | null {
  const normalized = normalizeFeedbackForSave(feedback);
  if (normalized.feedbackStatus !== "Pending" && !normalized.feedbackDate) {
    return "Feedback date is required when feedback status is not Pending.";
  }
  return null;
}
