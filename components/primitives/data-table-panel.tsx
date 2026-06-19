"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { usePaginatedRows } from "@/lib/hooks/use-paginated-rows";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/ui/paginate-rows";
import { cn } from "@/lib/utils";

type PaginationState<T> = ReturnType<typeof usePaginatedRows<T>>;

type DataTablePanelProps<T> = {
  pagination: PaginationState<T>;
  renderTable: (slice: T[]) => React.ReactNode;
  className?: string;
  scrollClassName?: string;
  fillViewport?: boolean;
  toolbarLabel?: string;
};

export function DataTablePanel<T>({
  pagination: pg,
  renderTable,
  className,
  scrollClassName,
  fillViewport = false,
  toolbarLabel = "Rows per page",
}: DataTablePanelProps<T>) {
  const { total, start, end, pageSize, page, totalPages, slice } = pg;

  if (total === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "platform-report-table-panel",
        fillViewport && "data-table-panel--fill",
        className
      )}
    >
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

      {pageSize !== "all" && totalPages > 1 && (
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
      )}
    </div>
  );
}

export { usePaginatedRows } from "@/lib/hooks/use-paginated-rows";
