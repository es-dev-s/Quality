"use client";

import { auditLogQueryString,type AuditLogPage,type AuditLogQuery } from "@/lib/audit/log-query";
import { useCallback,useEffect,useReducer,useRef,useState } from "react";

/** GET requests can be aborted on filter changes and when leaving the page. */
export function useAuditLogPage(initialPage: AuditLogPage) {
  const [query, setQuery] = useState(initialPage.query);
  const [data, setData] = useState(initialPage);
  const [completed, setCompleted] = useState(`${auditLogQueryString(initialPage.query)}:0`);
  const [error, setError] = useState<string | null>(null);
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const initialRef = useRef(initialPage);
  const requestKey = `${auditLogQueryString(query)}:${revision}`;
  const loading = completed !== requestKey;

  useEffect(() => {
    if (initialRef.current !== initialPage) {
      initialRef.current = initialPage;
      refresh();
    }
  }, [initialPage]);

  useEffect(() => {
    const search = auditLogQueryString(query);
    const key = `${search}:${revision}`;
    if (completed === key) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/audit-logs?${search}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load audit logs.");
        if (controller.signal.aborted) return;
        const page = result as AuditLogPage;
        setData(page);
        setError(null);
        setCompleted(`${auditLogQueryString(page.query)}:${revision}`);
        setQuery((current) => auditLogQueryString(current) === search ? page.query : current);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Could not load audit logs.");
          setCompleted(key);
        }
      }
    })();
    return () => controller.abort();
  }, [query, revision, completed]);

  const changeFilters = useCallback((patch: Partial<AuditLogQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }, []);

  return { query, setQuery, data, loading, error: loading ? null : error, refresh, changeFilters };
}
