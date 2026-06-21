"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterClearButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function FilterClearButton({
  onClick,
  disabled,
  label = "Clear filters",
  className,
}: FilterClearButtonProps) {
  return (
    <button
      type="button"
      className={cn("filter-clear-btn", className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <X size={14} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
