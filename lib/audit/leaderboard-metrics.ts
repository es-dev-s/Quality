import {
  canonicalCategoryLabel,
  pickDisplayName,
  resolveParameterGroupKey,
} from "@/lib/audit/analytics-metric-keys";
import type {
  AnalyticsAggregationOptions,
  AnalyticsAuditRecord,
} from "@/lib/audit/analytics-metrics";

export type LeaderboardRow = {
  name: string;
  quality: number;
  final: number;
  fatals: number;
  fatalRate: number;
  count: number;
  fatalDetails: string[];
};

export type ParamAreaStat = {
  name: string;
  cat: string;
  pct: number;
};

export type LeaderboardAnalytics = {
  agents: LeaderboardRow[];
  supervisors: LeaderboardRow[];
  auditors: LeaderboardRow[];
  reasons: LeaderboardRow[];
  weakParams: ParamAreaStat[];
  strongParams: ParamAreaStat[];
};

function parseFatalList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type Bucket = {
  q: number[];
  f: number[];
  fatals: number;
  count: number;
  fatalDetails: string[];
};

function initBucket(): Bucket {
  return { q: [], f: [], fatals: 0, count: 0, fatalDetails: [] };
}

function processBuckets(buckets: Record<string, Bucket>): LeaderboardRow[] {
  return Object.entries(buckets)
    .map(([name, v]) => ({
      name,
      quality: Math.round(
        v.q.reduce((s, x) => s + x, 0) / (v.q.length || 1)
      ),
      final: Math.round(
        v.f.reduce((s, x) => s + x, 0) / (v.f.length || 1)
      ),
      fatals: v.fatals,
      fatalRate: v.count > 0 ? Math.round((v.fatals / v.count) * 100) : 0,
      count: v.count,
      fatalDetails: [...new Set(v.fatalDetails)],
    }))
    .sort((a, b) => b.quality - a.quality);
}

export function computeLeaderboardAnalytics(
  records: (AnalyticsAuditRecord & { reason?: string | null; fatalList?: unknown })[],
  aggregation: AnalyticsAggregationOptions = {
    mergeParametersAcrossInteractionTypes: false,
  }
): LeaderboardAnalytics {
  const categories = {
    agents: {} as Record<string, Bucket>,
    supervisors: {} as Record<string, Bucket>,
    auditors: {} as Record<string, Bucket>,
    reasons: {} as Record<string, Bucket>,
  };

  for (const record of records) {
    const keys = [
      { cat: "agents" as const, val: record.agent },
      { cat: "supervisors" as const, val: record.supervisor?.trim() || "Unassigned" },
      { cat: "auditors" as const, val: record.auditor?.trim() || "Unassigned" },
      { cat: "reasons" as const, val: record.reason?.trim() || "Not specified" },
    ];

    for (const { cat, val } of keys) {
      if (!categories[cat][val]) categories[cat][val] = initBucket();
      const entry = categories[cat][val];
      entry.q.push(record.qualityPct);
      entry.f.push(record.finalPct);
      entry.count += 1;
      if (record.hasFatal) {
        entry.fatals += 1;
        entry.fatalDetails.push(...parseFatalList(record.fatalList));
      }
    }
  }

  const paramTotals = new Map<
    string,
    { scored: number; max: number; cat: string; displayName: string }
  >();

  for (const record of records) {
    for (const row of record.rows) {
      if (row.sel === "NA" || row.max <= 0) continue;
      const key = resolveParameterGroupKey(
        row,
        aggregation.mergeParametersAcrossInteractionTypes
      );
      const entry = paramTotals.get(key) ?? {
        scored: 0,
        max: 0,
        cat: canonicalCategoryLabel(row.cat),
        displayName: row.name?.trim() || row.id,
      };
      entry.displayName = pickDisplayName(entry.displayName, row.name);
      entry.cat = canonicalCategoryLabel(row.cat || entry.cat);
      entry.scored += row.score;
      entry.max += row.max;
      paramTotals.set(key, entry);
    }
  }

  const paramAnalysis = Array.from(paramTotals.values())
    .map((value) => ({
      name: value.displayName,
      cat: value.cat,
      pct: value.max > 0 ? Math.round((value.scored / value.max) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  return {
    agents: processBuckets(categories.agents),
    supervisors: processBuckets(categories.supervisors),
    auditors: processBuckets(categories.auditors),
    reasons: processBuckets(categories.reasons),
    weakParams: paramAnalysis.slice(0, 5),
    strongParams: [...paramAnalysis].reverse().slice(0, 5),
  };
}
