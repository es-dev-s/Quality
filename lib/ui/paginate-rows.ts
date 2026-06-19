export type TablePageSize = 20 | 50 | "all";

export const TABLE_PAGE_SIZE_OPTIONS: { value: TablePageSize; label: string }[] = [
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: "all", label: "All" },
];

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: TablePageSize
): {
  slice: T[];
  totalPages: number;
  start: number;
  end: number;
  total: number;
} {
  const total = rows.length;
  if (total === 0) {
    return { slice: [], totalPages: 1, start: 0, end: 0, total: 0 };
  }

  if (pageSize === "all") {
    return { slice: rows, totalPages: 1, start: 1, end: total, total };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

  return {
    slice: rows.slice(startIdx, endIdx),
    totalPages,
    start: startIdx + 1,
    end: endIdx,
    total,
  };
}
