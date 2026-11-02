"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { isAuditSSEEvent, isAgentTransferSSEEvent } from "@/lib/sse-events";
import type { Dispatch, SetStateAction } from "react";
import type { PageInfo } from "@/lib/server/page-query";
import type { TablePageSize } from "@/lib/ui/paginate-rows";

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
}
const eventTokens = new WeakMap<object, string>();
let eventSequence = 0;
function eventToken(event: object) {
  const existing = eventTokens.get(event);
  if (existing) return existing;
  const token = `${Date.now()}-${++eventSequence}`;
  eventTokens.set(event, token);
  return token;
}

export function useServerResource<T>(view: string, query: object, initialData: T, initialQuery: object) {
  const queryKey = stableKey(query);
  const initialKey = stableKey(initialQuery);
  const [nonce, setNonce] = useState("");
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtime((event) => {
    if (!isAuditSSEEvent(event) && !isAgentTransferSSEEvent(event)) return;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    // All consumers of one event share the server's in-flight aggregate result.
    const token = eventToken(event);
    liveTimer.current = setTimeout(() => setNonce(token), 500);
  });
  useEffect(() => () => { if (liveTimer.current) clearTimeout(liveTimer.current); }, []);
  const key = `${queryKey}:${nonce}`;
  const [state, setState] = useState({ data: initialData, completed: queryKey === initialKey ? key : "", error: null as string | null, initialData, initialKey });
  if (state.initialData !== initialData || state.initialKey !== initialKey) {
    setState({ ...state, initialData, initialKey, ...(queryKey === initialKey ? { data: initialData, completed: key, error: null } : { completed: "" }) });
  }
  useEffect(() => {
    if (state.completed === key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void (async () => {
      try {
        const params = new URLSearchParams({ view, query: queryKey, refresh: nonce });
        const response = await fetch(`/api/workspace-data?${params}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load data.");
        if (!controller.signal.aborted) setState((current) => ({ ...current, data: result as T, completed: key, error: null }));
      } catch (error) {
        if (!controller.signal.aborted) setState((current) => ({ ...current, completed: key, error: error instanceof Error ? error.message : "Could not load data." }));
      }
    })(); }, ["dashboard", "analytics", "kpi"].includes(view) ? 150 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [view, queryKey, nonce, key, state.completed]);
  return { data: state.data, loading: state.completed !== key, error: state.completed === key ? state.error : null, refresh: () => setNonce(String(Date.now())) };
}

export function usePageState(filterKey: string) {
  const [state, setState] = useState({ filterKey, page: 1, pageSize: 20 as 20 | 50 });
  if (state.filterKey !== filterKey) setState({ ...state, filterKey, page: 1 });
  const page = state.filterKey === filterKey ? state.page : 1;
  const setPage: Dispatch<SetStateAction<number>> = (next) => setState((current) => ({ ...current, filterKey, page: typeof next === "function" ? next(current.filterKey === filterKey ? current.page : 1) : next }));
  const setPageSize: Dispatch<SetStateAction<TablePageSize>> = (next) => setState((current) => {
    const size = typeof next === "function" ? next(current.pageSize) : next;
    return { filterKey, page: 1, pageSize: size === 50 ? 50 : 20 };
  });
  return { page, pageSize: state.pageSize, setPage, setPageSize, handlePageSizeChange: (size: TablePageSize) => setPageSize(size) };
}

export function remotePagination<T>(rows: T[], info: PageInfo, state: ReturnType<typeof usePageState>) {
  return { ...info, ...state, page: info.page, slice: rows };
}
