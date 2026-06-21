"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/primitives/field";
import { FilterChipBar, type FilterChip } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";

type TableFilterBarProps = {
  meta?: React.ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  activeFilterCount?: number;
  onOpenFilters?: () => void;
  chips?: FilterChip[];
  onClearAll?: () => void;
  actions?: React.ReactNode;
  showFilterButton?: boolean;
};

export function TableFilterBar({
  meta,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchAriaLabel = "Search",
  activeFilterCount = 0,
  onOpenFilters,
  chips = [],
  onClearAll,
  actions,
  showFilterButton = true,
}: TableFilterBarProps) {
  const hasSearch = search !== undefined && onSearchChange !== undefined;
  const hasChips = chips.length > 0;

  if (!hasSearch && !showFilterButton && !actions && !meta && !hasChips) {
    return null;
  }

  return (
    <>
      <div className="table-filter-bar">
        {meta ? <span className="table-filter-bar__meta">{meta}</span> : null}
        {hasSearch ? (
          <div className="table-filter-bar__search">
            <Search size={16} className="table-filter-bar__search-icon" aria-hidden />
            <Input
              className="ui-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={searchAriaLabel}
            />
          </div>
        ) : null}
        {showFilterButton ? (
          <div className="table-filter-bar__chips">
            <FilterChipBar inline showClearButton={false} chips={chips} />
          </div>
        ) : hasChips ? (
          <FilterChipBar chips={chips} onClearAll={onClearAll} />
        ) : null}
        <div className="table-filter-bar__actions">
          {showFilterButton && onOpenFilters ? (
            <div className="table-filter-bar__filter-actions">
              {activeFilterCount > 0 && onClearAll ? (
                <FilterClearButton onClick={onClearAll} />
              ) : null}
              <FilterTriggerButton
                activeCount={activeFilterCount}
                onClick={onOpenFilters}
              />
            </div>
          ) : null}
          {actions}
        </div>
      </div>
    </>
  );
}
