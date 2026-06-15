"use client";

import { Input } from "@/components/primitives/field";
import type { AuditLogEntry } from "@/lib/audit/audit-records";
import type { FeedbackStatus } from "@/lib/audit/feedback";
import {
  formatFeedbackDateTime,
  getStatusDateTimeLabel,
  getStatusDateTimeValue,
  isoToLocalDateTime,
} from "@/lib/audit/feedback-datetime";

type FeedbackStatusDateTimeCellProps = {
  row: AuditLogEntry;
  editable: boolean;
  onChange: (patch: {
    feedbackDate?: string | null;
    feedbackStatusAt?: string | null;
  }) => void;
};

export function applyFeedbackStatusChange(
  row: AuditLogEntry,
  feedbackStatus: FeedbackStatus
): Pick<AuditLogEntry, "feedbackStatus" | "feedbackDate" | "feedbackStatusAt"> {
  const nowIso = new Date().toISOString();

  if (feedbackStatus === "Pending") {
    return {
      feedbackStatus,
      feedbackDate: null,
      feedbackStatusAt: null,
    };
  }

  if (feedbackStatus === "Shared") {
    return {
      feedbackStatus,
      feedbackDate: row.feedbackDate ?? nowIso,
      feedbackStatusAt: row.feedbackStatusAt,
    };
  }

  return {
    feedbackStatus,
    feedbackDate: row.feedbackDate,
    feedbackStatusAt: row.feedbackStatusAt ?? nowIso,
  };
}

export function applyFeedbackDateTimeChange(
  row: AuditLogEntry,
  localValue: string
): Pick<AuditLogEntry, "feedbackDate" | "feedbackStatusAt"> {
  if (row.feedbackStatus === "Shared") {
    return { feedbackDate: localValue || null, feedbackStatusAt: row.feedbackStatusAt };
  }

  if (
    row.feedbackStatus === "Acknowledged" ||
    row.feedbackStatus === "Disputed"
  ) {
    return {
      feedbackDate: row.feedbackDate,
      feedbackStatusAt: localValue || null,
    };
  }

  return {
    feedbackDate: localValue || null,
    feedbackStatusAt: row.feedbackStatusAt,
  };
}

export function FeedbackStatusDateTimeCell({
  row,
  editable,
  onChange,
}: FeedbackStatusDateTimeCellProps) {
  const value = getStatusDateTimeValue(row);

  if (row.feedbackStatus === "Pending") {
    return <span className="audit-logs__datetime-muted">—</span>;
  }

  if (!editable) {
    return (
      <span className="audit-logs__datetime-read" title={value ?? undefined}>
        {formatFeedbackDateTime(value)}
      </span>
    );
  }

  return (
    <Input
      className="audit-logs__feedback-datetime"
      type="datetime-local"
      value={isoToLocalDateTime(value)}
      onChange={(e) => onChange(applyFeedbackDateTimeChange(row, e.target.value))}
      aria-label={`${getStatusDateTimeLabel(row.feedbackStatus)} for ${row.agent}`}
    />
  );
}
