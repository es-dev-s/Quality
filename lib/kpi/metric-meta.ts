import type { KpiColumn } from "@/lib/kpi/columns";
import { KPI_COLUMNS } from "@/lib/kpi/columns";

/** Primary cards shown above the detail list. */
export const KPI_PRIMARY_COLUMNS = [
  "Audit Frequency",
  "Audit Coverage",
  "Call Quality Score (IQA)",
  "Feedback Coverage",
  "Rebuttal",
] as const satisfies readonly KpiColumn[];

export type KpiPrimaryColumn = (typeof KPI_PRIMARY_COLUMNS)[number];

export const KPI_METRIC_HINTS: Record<KpiColumn, string> = {
  "Audit Frequency": "Audits completed vs period target",
  "Audit Coverage": "Agents audited vs roster (W1/W2 in month)",
  "Call Quality Score (IQA)": "Average quality score (Call-first)",
  Rebuttal: "Disputed feedback rate",
  "Feedback Coverage": "Shared or acknowledged feedback",
  "Hygiene Audit": "Not tracked in audit data yet",
  "Audit DipCheck (RTR)": "Not tracked in audit data yet",
  "Calibration Variance": "Calibration audits · score spread",
  "Project Initiatives": "Not tracked in audit data yet",
  "Call Taking": "Call vs Chat audit mix",
  "Team Attrition": "Not tracked in audit data yet",
};

export function isUnavailableKpiValue(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || value === "" || value === "—";
}

export function formatKpiDisplay(
  value: string | number | null | undefined
): string {
  if (isUnavailableKpiValue(value)) return "—";
  return String(value);
}

export const KPI_DETAIL_COLUMNS: KpiColumn[] = KPI_COLUMNS.filter(
  (column) =>
    !(KPI_PRIMARY_COLUMNS as readonly string[]).includes(column)
);
