"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterChipBarProps = {
  chips: FilterChip[];
  onClearAll?: () => void;
  className?: string;
  /** Inline chips inside a toolbar row (no extra row below). */
  inline?: boolean;
  /** Show the clear-all control (inline toolbars usually place this beside the Filters button). */
  showClearButton?: boolean;
};

export function FilterChipBar({
  chips,
  onClearAll,
  className,
  inline = false,
  showClearButton = true,
}: FilterChipBarProps) {
  const hasChips = chips.length > 0;

  if (!hasChips && !inline) {
    return null;
  }

  return (
    <div
      className={cn(
        className ?? "filter-chip-bar",
        inline && "filter-chip-bar--inline",
        inline && !hasChips && "filter-chip-bar--inline-empty"
      )}
      role={hasChips ? "status" : undefined}
      aria-hidden={!hasChips}
    >
      {hasChips ? (
        <>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="filter-chip"
              onClick={chip.onRemove}
              title={`Remove ${chip.label}`}
            >
              {chip.label}
              <X size={12} aria-hidden />
            </button>
          ))}
          {onClearAll && showClearButton ? (
            <button
              type="button"
              className="filter-chip-bar__clear"
              onClick={onClearAll}
            >
              Clear all
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
