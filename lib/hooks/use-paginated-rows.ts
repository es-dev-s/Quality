"use client";

import { useEffect, useMemo, useState } from "react";
import {
  paginateRows,
  type TablePageSize,
} from "@/lib/ui/paginate-rows";

/**
 * @param resetKey When this changes (filters, dataset identity), page resets to 1.
 *   Pass a stable key — not the rows array reference — so in-place row patches
 *   (e.g. feedback status) do not reset pagination.
 */
export function usePaginatedRows<T>(
  rows: T[],
  initialPageSize: TablePageSize = 20,
  resetKey?: string
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(initialPageSize);

  const paginationIdentity = resetKey ?? `count:${rows.length}`;

  const pagination = useMemo(
    () => paginateRows(rows, page, pageSize),
    [rows, page, pageSize]
  );

  useEffect(() => {
    setPage((current) => (current === 1 ? current : 1));
  }, [paginationIdentity, pageSize]);

  useEffect(() => {
    setPage((current) => {
      const maxPage = Math.max(1, pagination.totalPages);
      return current > maxPage ? maxPage : current;
    });
  }, [pagination.totalPages]);

  function handlePageSizeChange(next: TablePageSize) {
    setPageSize(next);
    setPage(1);
  }

  return {
    ...pagination,
    page,
    setPage,
    pageSize,
    setPageSize,
    handlePageSizeChange,
  };
}
