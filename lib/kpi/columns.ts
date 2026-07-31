/** Superadmin KPI workbook columns (display order). */
export const KPI_COLUMNS = [
  "Audit Frequency",
  "Audit Coverage",
  "Call Quality Score (IQA)",
  "Rebuttal",
  "Feedback Coverage",
  "Hygiene Audit",
  "Audit DipCheck (RTR)",
  "Calibration Variance",
  "Project Initiatives",
  "Call Taking",
  "Team Attrition",
] as const;

export type KpiColumn = (typeof KPI_COLUMNS)[number];

export type KpiRow = {
  id: string;
  values: Partial<Record<KpiColumn, string | number | null>>;
};
