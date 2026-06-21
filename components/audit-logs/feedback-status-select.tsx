"use client";

import { Select } from "@/components/primitives/field";
import type { FeedbackStatus } from "@/lib/audit/feedback";
import { getFeedbackStatusSelectConfig } from "@/lib/audit/feedback-status-access";
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

  if (!config.showSelect) {
    return (
      <span
        className={cn(
          "audit-logs__feedback audit-logs__feedback--readonly",
          feedbackStatusClass(value),
          className
        )}
        title={config.hint}
      >
        {value}
      </span>
    );
  }

  return (
    <Select
      className={cn("audit-logs__feedback", feedbackStatusClass(value), className)}
      value={config.selectValue}
      disabled={!config.editable}
      title={config.hint}
      aria-label={ariaLabel}
      options={config.options.map((option) => ({
        value: option.value,
        label: option.label,
        disabled: option.disabled,
      }))}
      onChange={(event) => {
        if (!config.editable) return;
        const next = event.target.value as FeedbackStatus;
        if (!next || next === value) return;
        onChange(next);
      }}
    />
  );
}
