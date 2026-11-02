"use client";
import type { AnalyticsQuery,AnalyticsSummary,BreakdownKey } from "@/lib/audit/analytics-query";
import { remotePagination,usePageState,useServerResource } from "@/lib/hooks/use-server-resource";
import { createContext,useContext,type ReactNode } from "react";

const Context = createContext<{ query: AnalyticsQuery; data: AnalyticsSummary } | null>(null);
export function AnalyticsPaginationProvider({ query, data, children }: { query: AnalyticsQuery; data: AnalyticsSummary; children: ReactNode }) {
  return <Context.Provider value={{ query, data }}>{children}</Context.Provider>;
}
export function useAnalyticsBreakdown(key: BreakdownKey) {
  const context = useContext(Context);
  if (!context) throw new Error("Analytics pagination context is required.");
  const state = usePageState(JSON.stringify([context.query, key]));
  const query = { ...context.query, table: key, page: state.page, pageSize: state.pageSize };
  const initialQuery = { ...context.query, table: key, page: 1, pageSize: 20 };
  const resource = useServerResource("analytics", query, context.data, initialQuery);
  return { ...resource, pagination: remotePagination(resource.data.analytics[key], resource.data.pagination[key], state) };
}
