/**
 * Report period + filter validation checks.
 * Run: npx tsx scripts/verify-report-filters.ts
 */
import {
  relatedNames,
  reportPeopleSelectOptions,
  withCurrentSelection,
} from "@/lib/reports/report-filter-options";
import {
  daysInclusive,
  defaultReportDateRange,
  defaultReportFilters,
  isDefaultReportDateRange,
  isValidIsoDate,
  periodMatchesRange,
  rangeForReportPeriod,
  startOfWeekMonday,
  toIsoDate,
} from "@/lib/reports/report-period";
import { reportFiltersSchema } from "@/lib/validation/reports";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 8, 6); // Sunday 6 Sep 2026 local
const today = toIsoDate(now);

assert(isValidIsoDate("2026-09-06"), "valid ISO date");
assert(!isValidIsoDate("2026-02-31"), "reject impossible calendar date");
assert(!isValidIsoDate("26-09-06"), "reject non ISO date");

const week = rangeForReportPeriod("weekly", now);
assert(week.end === today, "weekly ends today");
assert(week.start === toIsoDate(startOfWeekMonday(now)), "weekly starts Monday");
assert(week.start === "2026-08-31", "week of 6 Sep 2026 starts 31 Aug");

const month = rangeForReportPeriod("monthly", now);
assert(month.start === "2026-09-01" && month.end === today, "month to today");

const quarter = rangeForReportPeriod("quarterly", now);
assert(quarter.start === "2026-07-01" && quarter.end === today, "Q3 to today");

const year = rangeForReportPeriod("yearly", now);
assert(year.start === "2026-01-01" && year.end === today, "year to today");

const defaults = defaultReportFilters(now);
const defaultRange = defaultReportDateRange(now);
assert(defaults.period === "custom", "default period is custom");
assert(defaults.type === "", "default type is both");
assert(defaults.agent === "" && defaults.supervisor === "", "default people empty");
assert(
  defaults.startDate === defaultRange.start && defaults.endDate === defaultRange.end,
  "default dates are last 30 days"
);
assert(
  isDefaultReportDateRange(defaults.startDate, defaults.endDate, now),
  "default range helper"
);
assert(periodMatchesRange("monthly", month.start, month.end, now), "month matches");
assert(!periodMatchesRange("monthly", week.start, week.end, now), "week is not month");

assert(daysInclusive("2026-09-01", "2026-09-01") === 1, "inclusive single day");
assert(daysInclusive("2026-01-01", "2026-01-31") === 31, "inclusive January");

const valid = reportFiltersSchema.safeParse({
  startDate: "2026-09-01",
  endDate: "2026-09-06",
  agent: "  Ada  ",
  supervisor: "Sam",
  type: "Call",
  period: "monthly",
});
assert(valid.success, "accepts valid filters");
if (valid.success) {
  assert(valid.data.agent === "Ada", "trims agent name");
}

const inverted = reportFiltersSchema.safeParse({
  startDate: "2026-09-06",
  endDate: "2026-09-01",
});
assert(!inverted.success, "rejects inverted range");

const tooWide = reportFiltersSchema.safeParse({
  startDate: "2018-01-01",
  endDate: "2026-09-06",
});
assert(!tooWide.success, "rejects range over 5 years");

const related = relatedNames(
  ["Ann", "Ben", "Cara"],
  { Sam: ["Ann", "Cara"] },
  "Sam"
);
assert(related.join(",") === "Ann,Cara", "supervisor narrows agents");
assert(
  relatedNames(["Ann", "Ben"], { Sam: ["Ann"] }, "").join(",") === "Ann,Ben",
  "empty key keeps all"
);
assert(
  withCurrentSelection(["Ann"], "Zed").includes("Zed"),
  "keeps current selection"
);

const peopleOptions = reportPeopleSelectOptions(
  {
    agents: ["Ann", "Ben"],
    supervisors: ["Sam"],
    agentsBySupervisor: { Sam: ["Ann"] },
    supervisorsByAgent: { Ann: ["Sam"] },
  },
  "",
  "Sam"
);
assert(
  peopleOptions.agents.some((option) => option.value === "Ann") &&
    !peopleOptions.agents.some((option) => option.value === "Ben"),
  "people options honor supervisor pairing"
);

console.log("verify-report-filters: all checks passed");
