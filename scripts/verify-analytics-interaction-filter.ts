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
  canonicalCategoryLabel,
  categoryLabelForInteraction,
  crossTemplateParameterGroupKey,
  patchTemplateCategorySpelling,
  pickCategoryDisplayName,
} from "@/lib/audit/analytics-metric-keys";
import {
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
} from "@/lib/audit/rubrics";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const callAudit: AnalyticsAuditRecord = {
  id: "1",
  agent: "Agent A",
  supervisor: "Jane Supervisor",
  teamName: "Team 1",
  auditor: "QA 1",
  type: "Call",
  businessType: "Sales",
  callDate: "2026-06-01",
  auditDate: "2026-06-01",
  qualityPct: 80,
  finalPct: 80,
  hasFatal: false,
  isHistory: false,
  feedbackStatus: "Pending",
  feedbackSecurity: "NA",
  catScores: {
    "Sales $ Compliance": { scored: 8, max: 10 },
    "Call Compliance": { scored: 2, max: 2 },
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
    "Call Compliance": { scored: 2, max: 2 },
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
  canonicalCategoryLabel("Sales $ Compliance") === "Sales & Compliance",
  "Sales $ displays as Sales & Compliance"
);
assert(
  canonicalCategoryKey("Call Compliance") ===
    canonicalCategoryKey("Chat Compliance"),
  "Call and Chat Compliance share a category key"
);
assert(
  categoryLabelForInteraction("Call Compliance", "Chat") === "Chat Compliance",
  "Chat audits rewrite Call Compliance"
);
assert(
  categoryLabelForInteraction("Call Compliance", "Call") === "Call Compliance",
  "Call audits keep Call Compliance"
);
assert(
  pickCategoryDisplayName("Call Compliance", "Chat Compliance") ===
    "Compliance",
  "Mixed Call/Chat categories display without the channel prefix"
);

assert(
  CHAT_AUDIT_TEMPLATE.sections.some((section) => section.name === "Chat Compliance") &&
    !CHAT_AUDIT_TEMPLATE.sections.some((section) => section.name === "Call Compliance"),
  "Chat rubric uses Chat Compliance"
);
assert(
  CALL_AUDIT_TEMPLATE.sections.some((section) => section.name === "Sales & Compliance") &&
    !CALL_AUDIT_TEMPLATE.sections.some((section) => section.name.includes("Sales $")),
  "Call rubric uses Sales & Compliance"
);
assert(
  patchTemplateCategorySpelling({
    ...CHAT_AUDIT_TEMPLATE,
    sections: CHAT_AUDIT_TEMPLATE.sections.map((section) =>
      section.name === "Chat Compliance"
        ? { ...section, name: "Call Compliance", params: section.params.map((param) => ({ ...param, cat: "Call Compliance" })) }
        : section
    ),
  }).sections.some((section) => section.name === "Chat Compliance"),
  "Template patch rewrites legacy chat Call Compliance"
);

assert(
  crossTemplateParameterGroupKey(callAudit.rows[0]) ===
    crossTemplateParameterGroupKey(chatAudit.rows[0]),
  "Greeting merges across call/chat parameter ids"
);

const combined = applyAnalyticsFilters(records, {
  period: "overall",
  customRange: { from: "", to: "" },
  includeFilters: { agent: "", teamName: "", auditor: "", businessType: "" },
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
  combined.categories.some((row) => row.name === "Compliance"),
  "Combined Call + Chat Compliance displays as Compliance"
);
assert(
  combined.categories.filter((row) => /^(call|chat)?\s*compliance$/i.test(row.name))
    .length === 1,
  "Only one Compliance category row"
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
  includeFilters: { agent: "", teamName: "", auditor: "", businessType: "" },
  interactionFilter: "call",
  referenceNow: new Date("2026-06-15"),
});

assert(callOnly.filteredCount === 1, "Call-only filtered count");
assert(
  callOnly.kpis.chat_count === 0 && callOnly.kpis.call_count === 1,
  "Call-only KPI counts"
);
assert(
  callOnly.categories.some((row) => row.name === "Call Compliance"),
  "Call-only keeps Call Compliance"
);

const chatOnly = applyAnalyticsFilters(records, {
  period: "overall",
  customRange: { from: "", to: "" },
  includeFilters: { agent: "", teamName: "", auditor: "", businessType: "" },
  interactionFilter: "chat",
  referenceNow: new Date("2026-06-15"),
});
assert(
  chatOnly.categories.some((row) => row.name === "Chat Compliance"),
  "Chat-only rewrites Call Compliance"
);
assert(
  !chatOnly.categories.some((row) => row.name === "Call Compliance"),
  "Chat-only does not keep Call Compliance"
);

assert(
  DEFAULT_ANALYTICS_INTERACTION_FILTER === "both",
  "Default interaction filter is both"
);

const fatalA: AnalyticsAuditRecord = {
  ...callAudit,
  id: "f1",
  supervisor: "Jane Supervisor",
  teamName: "Night Shift",
  hasFatal: true,
};
const fatalB: AnalyticsAuditRecord = {
  ...callAudit,
  id: "f2",
  supervisor: "Bob Supervisor",
  teamName: "Night Shift",
  hasFatal: true,
};
const fatalView = applyAnalyticsFilters([fatalA, fatalB], {
  period: "overall",
  customRange: { from: "", to: "" },
  includeFilters: { agent: "", teamName: "", auditor: "", businessType: "" },
  interactionFilter: "both",
  referenceNow: new Date("2026-06-15"),
});
assert(
  fatalView.fatal_by_team.length === 1 &&
    fatalView.fatal_by_team[0]?.team === "Night Shift" &&
    fatalView.fatal_by_team[0]?.count === 2,
  "Fatal incidents group by team name, not supervisor person name"
);
assert(
  fatalView.teams.length === 1 && fatalView.teams[0]?.team === "Night Shift",
  "Team stats use team name rather than user name"
);

console.log("verify-analytics-interaction-filter: OK");
