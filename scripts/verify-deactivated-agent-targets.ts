/**
 * Per-agent target list hides deactivated users; other dashboard math is unchanged.
 * Run: ./node_modules/.bin/tsx scripts/verify-deactivated-agent-targets.ts
 */
import {
  computeAgentTargets,
  computePeriodStats,
  excludeDeactivatedAgentRecords,
  type DashboardAuditRecord,
} from "@/lib/audit/dashboard-metrics";

let errors = 0;

function fail(message: string) {
  console.error(`FAIL: ${message}`);
  errors += 1;
}

function ok(message: string) {
  console.log(`OK: ${message}`);
}

function record(
  id: string,
  agent: string,
  extras: Partial<DashboardAuditRecord> = {}
): DashboardAuditRecord {
  return {
    id,
    auditCode: id,
    agent,
    supervisor: null,
    auditor: "QA One",
    lob: "LOB",
    type: "Call",
    businessType: "Voice",
    callDate: "2026-09-01",
    auditDate: "2026-09-01",
    qualityPct: 90,
    finalPct: 90,
    hasFatal: false,
    fatalList: [],
    ...extras,
  };
}

const records = [
  record("a1", "Active Agent"),
  record("a2", "Active Agent"),
  record("d1", "Deactivated Agent"),
  record("d2", "deactivated agent"),
];

const filtered = excludeDeactivatedAgentRecords(records, ["Deactivated Agent"]);
if (filtered.length !== 2 || filtered.some((row) => row.agent.toLowerCase() === "deactivated agent")) {
  fail("deactivated agent names must drop from the per-agent record set");
} else {
  ok("deactivated agent rows are excluded from the per-agent set");
}

const untouched = excludeDeactivatedAgentRecords(records, []);
if (untouched.length !== records.length) {
  fail("empty deactivated list must leave records unchanged");
} else {
  ok("no deactivated names leaves the record set unchanged");
}

const targets = computeAgentTargets(filtered, filtered, 10);
if (targets.agents.some((row) => row.name.toLowerCase() === "deactivated agent")) {
  fail("computeAgentTargets still listed a deactivated agent");
} else if (targets.agents.length !== 1 || targets.agents[0]?.name !== "Active Agent") {
  fail("computeAgentTargets should keep only the active agent");
} else if (targets.cumulativeAchieved !== 2 || targets.cumulativeTarget !== 10) {
  fail("per-agent summary should count only remaining agents");
} else {
  ok("per-agent list and summary use only active agents");
}

const allStats = computePeriodStats(records);
const filteredStats = computePeriodStats(filtered);
if (allStats.total === filteredStats.total) {
  fail("other dashboard stats must still see deactivated-user audits unless filtered separately");
} else if (allStats.total !== 4) {
  fail("unfiltered dashboard stats lost records");
} else {
  ok("other dashboard stats still include deactivated-user audits");
}

if (errors > 0) {
  process.exitCode = 1;
} else {
  console.log("deactivated agent-target checks passed");
}
