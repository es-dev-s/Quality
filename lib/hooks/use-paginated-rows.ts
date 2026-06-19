"use client";

import { useEffect, useMemo, useState } from "react";
import {
  paginateRows,
  type TablePageSize,
} from "@/lib/ui/paginate-rows";

export function usePaginatedRows<T>(
  rows: T[],
  initialPageSize: TablePageSize = 20
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(initialPageSize);

  const pagination = useMemo(
    () => paginateRows(rows, page, pageSize),
    [rows, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(Math.max(1, pagination.totalPages));
    }
  }, [page, pagination.totalPages]);

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
