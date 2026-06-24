import type { FeedbackStatus } from "@/lib/audit/feedback";

/** Value for `<input type="datetime-local" />` (YYYY-MM-DDTHH:mm). */
export function nowLocalDateTime(): string {
  return isoToLocalDateTime(new Date().toISOString());
}

export function isoToLocalDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return trimmed.length >= 16 ? trimmed.slice(0, 16) : trimmed;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Persist as ISO string; accepts date-only or datetime-local values. */
export function localDateTimeToIso(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toISOString();
}

export function formatFeedbackDateTime(
  value: string | null | undefined
): string {
  if (!value?.trim()) return "—";

  const date = new Date(localDateTimeToIso(value) || value.trim());
  if (Number.isNaN(date.getTime())) return value.trim();

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getStatusDateTimeValue(row: {
  feedbackStatus: FeedbackStatus;
  feedbackDate: string | null;
  feedbackStatusAt: string | null;
}): string | null {
  if (row.feedbackStatus === "Pending") return null;
  if (row.feedbackStatus === "Shared") return row.feedbackDate;
  if (
    row.feedbackStatus === "Acknowledged" ||
    row.feedbackStatus === "Disputed"
  ) {
    return row.feedbackStatusAt;
  }
  return row.feedbackDate;
}

export function getStatusDateTimeLabel(status: FeedbackStatus): string {
  switch (status) {
    case "Shared":
      return "Feedback date & time";
    case "Acknowledged":
      return "Acknowledged date & time";
    case "Disputed":
      return "Disputed date & time";
    default:
      return "Date & time";
  }
}

export function resolveStatusTimestamps(input: {
  feedbackStatus: FeedbackStatus;
  feedbackDate: string;
  feedbackStatusAt: string;
  previousStatus: FeedbackStatus;
  existingFeedbackDate: string | null;
  existingFeedbackStatusAt: string | null;
}): { feedbackDate: string | null; feedbackStatusAt: string | null } {
  const now = new Date().toISOString();
  const status = input.feedbackStatus;
  const previous = input.previousStatus;

  if (status === "Pending") {
    return { feedbackDate: null, feedbackStatusAt: null };
  }

  let feedbackDate = input.existingFeedbackDate;
  let feedbackStatusAt = input.existingFeedbackStatusAt;

  if (status === "Shared") {
    if (previous === "Acknowledged" || previous === "Disputed") {
      feedbackStatusAt = null;
    }
    const incoming = input.feedbackDate.trim();
    if (incoming) {
      feedbackDate = localDateTimeToIso(incoming) || incoming;
    } else if (status !== previous || !feedbackDate) {
      feedbackDate = now;
    }
    return { feedbackDate, feedbackStatusAt };
  }

  if (status === "Acknowledged" || status === "Disputed") {
    const incoming = input.feedbackStatusAt.trim();
    if (incoming) {
      feedbackStatusAt = localDateTimeToIso(incoming) || incoming;
    } else if (status !== previous || !feedbackStatusAt) {
      feedbackStatusAt = now;
    }
    return { feedbackDate, feedbackStatusAt };
  }

  return { feedbackDate, feedbackStatusAt };
}
