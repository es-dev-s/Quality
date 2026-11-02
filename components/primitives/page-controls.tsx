"use client";
import type { PageInfo } from "@/lib/server/page-query";

export function PageControls({ pagination, onPage, loading = false }: { pagination: PageInfo; onPage: (page: number) => void; loading?: boolean }) {
  if (pagination.totalPages <= 1) return null;
  return <div className="platform-report-pagination">
    <button type="button" className="platform-report-pagination__btn" disabled={loading || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Prev</button>
    <span className="platform-report-pagination__info">{pagination.start}–{pagination.end} of {pagination.total} · Page {pagination.page} of {pagination.totalPages}</span>
    <button type="button" className="platform-report-pagination__btn" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Next</button>
  </div>;
}
