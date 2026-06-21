"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { usePaginatedRows } from "@/lib/hooks/use-paginated-rows";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/ui/paginate-rows";
import { cn } from "@/lib/utils";
import { FilterChipBar, type FilterChip } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import { Input } from "@/components/primitives/field";

type PaginationState<T> = ReturnType<typeof usePaginatedRows<T>>;

type TableSearchControl = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

type TableFilterControl = {
  activeCount?: number;
  onOpen: () => void;
  label?: string;
};

type DataTablePanelProps<T> = {
  pagination: PaginationState<T>;
  renderTable: (slice: T[]) => React.ReactNode;
  className?: string;
  scrollClassName?: string;
  fillViewport?: boolean;
  toolbarLabel?: string;
  search?: TableSearchControl;
  filterControl?: TableFilterControl;
  filterChips?: FilterChip[];
  onClearFilters?: () => void;
  headerActions?: React.ReactNode;
  /** Shown inside the table shell when the filtered set is empty (search/filters stay visible). */
  emptyState?: React.ReactNode;
  /** Row count label in the header toolbar, e.g. "12 users". */
  summaryLabel?: string;
};

export function DataTablePanel<T>({
  pagination: pg,
  renderTable,
  className,
  scrollClassName,
  fillViewport = false,
  toolbarLabel = "Rows per page",
  search,
  filterControl,
  filterChips,
  onClearFilters,
  headerActions,
  emptyState,
  summaryLabel,
}: DataTablePanelProps<T>) {
  const { total, start, end, pageSize, page, totalPages, slice } = pg;

  const hasHeaderControls = Boolean(
    search || filterControl || headerActions || summaryLabel
  );
  const showFilterChipSlot = Boolean(filterControl || filterChips !== undefined);
  const showShell =
    hasHeaderControls || showFilterChipSlot || total > 0 || emptyState;

  if (!showShell) {
    return null;
  }

  const isEmpty = total === 0;
  const activeFilterCount = filterControl?.activeCount ?? 0;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div
      className={cn(
        "platform-report-table-panel",
        fillViewport && "data-table-panel--fill",
        isEmpty && "platform-report-table-panel--empty",
        className
      )}
    >
      {hasHeaderControls || showFilterChipSlot ? (
        <div className="platform-report-table-header">
          {summaryLabel ? (
            <span className="platform-report-table-header__summary">
              {summaryLabel}
            </span>
          ) : null}
          {search ? (
            <div className="platform-report-table-header__search">
              <Search
                size={16}
                className="platform-report-table-header__search-icon"
                aria-hidden
              />
              <Input
                className="ui-input"
                placeholder={search.placeholder ?? "Search…"}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                aria-label={search.ariaLabel ?? "Search table"}
              />
            </div>
          ) : null}
          {showFilterChipSlot ? (
            <div className="platform-report-table-header__chips">
              <FilterChipBar
                inline
                showClearButton={false}
                chips={filterChips ?? []}
              />
            </div>
          ) : null}
          <div className="platform-report-table-header__actions">
            {filterControl ? (
              <div className="platform-report-table-header__filter-actions">
                <FilterTriggerButton
                  activeCount={activeFilterCount}
                  onClick={filterControl.onOpen}
                  label={filterControl.label}
                />
                {hasActiveFilters && onClearFilters ? (
                  <FilterClearButton onClick={onClearFilters} />
                ) : null}
              </div>
            ) : null}
            {headerActions}
          </div>
        </div>
      ) : null}

      {!isEmpty ? (
        <>
          <div className="platform-report-table-toolbar">
            <div className="platform-report-table-toolbar__left">
              <span className="platform-report-table-toolbar__label">
                {toolbarLabel}
              </span>
              <div className="pf-periods" role="group" aria-label={toolbarLabel}>
                {TABLE_PAGE_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={cn(
                      "pf-period-btn",
                      pageSize === opt.value && "pf-period-btn--active"
                    )}
                    onClick={() => pg.handlePageSizeChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="platform-report-table-toolbar__meta">
              Showing{" "}
              <strong>
                {start}–{end}
              </strong>{" "}
              of <strong>{total}</strong>
            </p>
          </div>

          <div
            className={cn(
              "platform-report-table__scroll",
              fillViewport && "data-table-panel__scroll--fill",
              scrollClassName
            )}
          >
            {renderTable(slice)}
          </div>

          {pageSize !== "all" && totalPages > 1 ? (
            <div className="platform-report-pagination">
              <button
                type="button"
                className="platform-report-pagination__btn"
                disabled={page <= 1}
                onClick={() => pg.setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} aria-hidden />
                Prev
              </button>
              <span className="platform-report-pagination__info">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                className="platform-report-pagination__btn"
                disabled={page >= totalPages}
                onClick={() => pg.setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="platform-report-table-empty">
          {emptyState ?? "No matching rows."}
        </div>
      )}
    </div>
  );
}

export { usePaginatedRows } from "@/lib/hooks/use-paginated-rows";
