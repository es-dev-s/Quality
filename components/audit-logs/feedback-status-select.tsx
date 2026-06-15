"use client";

import { Select } from "@/components/primitives/field";
import type { FeedbackStatus } from "@/lib/audit/feedback";
import {
  getFeedbackStatusSelectConfig,
} from "@/lib/audit/feedback-status-access";
import type { SessionRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type FeedbackStatusSelectProps = {
  role: SessionRole | null | undefined;
  value: FeedbackStatus;
  className?: string;
  onChange: (status: FeedbackStatus) => void;
  ariaLabel: string;
};

export function feedbackStatusClass(status: FeedbackStatus) {
  if (status === "Pending") return "audit-logs__feedback--pending";
  if (status === "Shared") return "audit-logs__feedback--shared";
  if (status === "Acknowledged") return "audit-logs__feedback--acknowledged";
  return "audit-logs__feedback--disputed";
}

export function FeedbackStatusSelect({
  role,
  value,
  className,
  onChange,
  ariaLabel,
}: FeedbackStatusSelectProps) {
  const config = getFeedbackStatusSelectConfig(role, value);

  if (!config.editable) {
    return (
      <span className={cn("audit-logs__feedback", feedbackStatusClass(value), className)}>
        {value}
      </span>
    );
  }

  return (
    <Select
      className={cn("audit-logs__feedback", feedbackStatusClass(value), className)}
      value={config.selectValue}
      onChange={(e) => {
        const next = e.target.value as FeedbackStatus | "";
        if (!next) return;
        onChange(next);
      }}
      aria-label={ariaLabel}
    >
      {config.placeholder ? (
        <option value="">{config.placeholder}</option>
      ) : null}
      {config.options.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </Select>
  );
}
