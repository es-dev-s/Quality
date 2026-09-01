/** Quality % required for an audit to count as "passed" (non-fatal). */
export const PASS_RATE_QUALITY_THRESHOLD = 95;

/** Display target for pass-rate KPIs and reports. */
export const PASS_RATE_TARGET_PCT = 95;

type QualityAverageRecord = {
  hasFatal: boolean;
  qualityPct: number;
};

/**
 * Quality % used in platform averages (dashboard, analytics, reports, KPI).
 * FATAL audits count as 0 — same as final score.
 */
export function qualityPctForAverage(record: QualityAverageRecord): number {
  return record.hasFatal ? 0 : record.qualityPct;
}
