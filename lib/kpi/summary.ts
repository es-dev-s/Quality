import { z } from "zod";
import { DEFAULT_KPI_FILTERS } from "@/lib/kpi/filters";
import { computeKpiRows } from "@/lib/kpi/compute-kpi";
import type { KpiFilterOptions } from "@/lib/kpi/filters";
import type { KpiPageData } from "@/lib/kpi/records";

export const kpiQuerySchema = z.object({
  filters: z.object({
    time: z.enum(["all", "today", "yesterday", "week", "month", "3m", "6m", "1y", "custom"]).default("month"),
    customFrom: z.union([z.literal(""), z.iso.date()]).default(""), customTo: z.union([z.literal(""), z.iso.date()]).default(""),
    qm: z.string().max(200).default(""), qa: z.string().max(200).default(""),
  }).default(DEFAULT_KPI_FILTERS),
  targetPerAgent: z.number().min(1).max(999).optional(),
});

export function buildKpiSummary(source: KpiPageData, filterOptions: KpiFilterOptions, input: z.infer<typeof kpiQuerySchema>) {
  const rows = computeKpiRows({ records: source.records, filters: input.filters, rosterAgentNames: source.rosterAgentNames, targetPerAgent: input.targetPerAgent ?? source.targetPerAgent, qmAgentNamesByQm: filterOptions.qmAgentNamesByQm });
  return { summary: rows.find((row) => row.id === "overall") ?? null, agentCount: Math.max(0, rows.length - 1), targetPerAgent: source.targetPerAgent, filterOptions, fetchedAt: source.fetchedAt };
}
export type KpiSummary = ReturnType<typeof buildKpiSummary>;
