"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterTriggerButtonProps = {
  activeCount?: number;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function FilterTriggerButton({
  activeCount = 0,
  onClick,
  disabled,
  label = "Filters",
  className,
}: FilterTriggerButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "filter-trigger-btn",
        activeCount > 0 && "filter-trigger-btn--active",
        className
      )}
      disabled={disabled}
      onClick={onClick}
      aria-label={
        activeCount > 0 ? `${label} (${activeCount} active)` : label
      }
    >
      <SlidersHorizontal size={15} aria-hidden />
      <span>{label}</span>
      {activeCount > 0 ? (
        <span className="filter-trigger-btn__badge" aria-hidden>
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}
