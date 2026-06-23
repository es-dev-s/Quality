/**
 * Analytics interaction filter + combined aggregation checks.
 * Run: npx tsx scripts/verify-analytics-interaction-filter.ts
 */
import {
  applyAnalyticsFilters,
  DEFAULT_ANALYTICS_INTERACTION_FILTER,
  filterAnalyticsByInteractionType,
  shouldMergeParametersAcrossInteractionTypes,
} from "@/lib/audit/analytics-filters";
import type { AnalyticsAuditRecord } from "@/lib/audit/analytics-metrics";
import {
  canonicalCategoryKey,
  crossTemplateParameterGroupKey,
} from "@/lib/audit/analytics-metric-keys";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const callAudit: AnalyticsAuditRecord = {
  id: "1",
  agent: "Agent A",
  supervisor: "Team 1",
  auditor: "QA 1",
  type: "Call",
  callDate: "2026-06-01",
  auditDate: "2026-06-01",
  qualityPct: 80,
  finalPct: 80,
  hasFatal: false,
  feedbackStatus: "Pending",
  feedbackSecurity: "NA",
  catScores: {
    "Sales $ Compliance": { scored: 8, max: 10 },
  },
  rows: [
    {
      id: "call-greeting",
      cat: "Call Compliance",
      name: "Greeting",
      max: 2,
      sel: "2",
      score: 2,
      fatal: false,
    },
  ],
};

const chatAudit: AnalyticsAuditRecord = {
  ...callAudit,
  id: "2",
  type: "Chat",
  qualityPct: 90,
  finalPct: 90,
  catScores: {
    "Sales & Compliance": { scored: 9, max: 10 },
  },
  rows: [
    {
      id: "chat-greeting",
      cat: "Call Compliance",
      name: "Greeting",
      max: 2,
      sel: "2",
      score: 2,
      fatal: false,
    },
  ],
};

const records = [callAudit, chatAudit];

assert(
  filterAnalyticsByInteractionType(records, "call").length === 1,
  "Call filter returns one record"
);
assert(
  filterAnalyticsByInteractionType(records, "chat").length === 1,
  "Chat filter returns one record"
);
assert(
  filterAnalyticsByInteractionType(records, "both").length === 2,
  "Both filter returns all records"
);

assert(
  shouldMergeParametersAcrossInteractionTypes("both"),
  "Both enables cross-template merge"
);
assert(
  !shouldMergeParametersAcrossInteractionTypes("call"),
  "Call-only keeps template-scoped merge"
);

assert(
  canonicalCategoryKey("Sales $ Compliance") ===
    canonicalCategoryKey("Sales & Compliance"),
  "Category keys normalize $ and &"
);

assert(
  crossTemplateParameterGroupKey(callAudit.rows[0]) ===
    crossTemplateParameterGroupKey(chatAudit.rows[0]),
  "Greeting merges across call/chat parameter ids"
);

const combined = applyAnalyticsFilters(records, {
  period: "overall",
  customRange: { from: "", to: "" },
  includeFilters: { agent: "", teamName: "", auditor: "" },
  interactionFilter: "both",
  referenceNow: new Date("2026-06-15"),
});

assert(combined.filteredCount === 2, "Combined view includes both audits");
assert(
  combined.categories.some((row) => row.name === "Sales & Compliance"),
  "Combined categories merge Sales variants"
);
assert(
  combined.categories.filter((row) => /sales.*compliance/i.test(row.name))
    .length === 1,
  "Only one Sales & Compliance category row"
);
assert(
  combined.params.some((row) => row.name === "Greeting"),
  "Combined parameters include Greeting"
);
assert(
  combined.params.filter((row) => row.name === "Greeting").length === 1,
  "Greeting appears once when combined"
);

const callOnly = applyAnalyticsFilters(records, {
  period: "overall",
  customRange: { from: "", to: "" },
  includeFilters: { agent: "", teamName: "", auditor: "" },
  interactionFilter: "call",
  referenceNow: new Date("2026-06-15"),
});

assert(callOnly.filteredCount === 1, "Call-only filtered count");
assert(
  callOnly.kpis.chat_count === 0 && callOnly.kpis.call_count === 1,
  "Call-only KPI counts"
);

assert(
  DEFAULT_ANALYTICS_INTERACTION_FILTER === "both",
  "Default interaction filter is both"
);

console.log("verify-analytics-interaction-filter: OK");
