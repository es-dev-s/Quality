/** Prefer audit date for KPIs; fall back to interaction date when missing. */
export function resolveMetricDate(
  auditDate: string | null | undefined,
  callDate: string | null | undefined
): string {
  const audit = auditDate?.trim();
  if (audit) return audit;
  return callDate?.trim() ?? "";
}
