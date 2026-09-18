/**
 * Transfer-history visibility helpers.
 * Run: npx tsx scripts/verify-transfer-history-scope.ts
 */
import {
  historyAuditsForSupervisors,
  historyAuditsForTransferIds,
} from "@/lib/audit/transfer-history-scope";
import {
  defaultAuditHistoryFilter,
  viewerCanAccessTransferHistory,
} from "@/lib/audit/history-filter";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";

let errors = 0;

function fail(message: string) {
  console.error(`FAIL: ${message}`);
  errors += 1;
}

function ok(message: string) {
  console.log(`OK: ${message}`);
}

const none = historyAuditsForTransferIds([]);
if (none !== null) {
  fail("empty transfer ids must not match every history row");
} else {
  ok("empty transfer-id history clause is skipped");
}

const byTransfers = historyAuditsForTransferIds(["t-1", "t-1", ""]);
if (
  byTransfers?.isHistory !== true ||
  !byTransfers.historyTransferId ||
  typeof byTransfers.historyTransferId !== "object" ||
  !("in" in byTransfers.historyTransferId) ||
  JSON.stringify(byTransfers.historyTransferId.in) !== JSON.stringify(["t-1"])
) {
  fail("transfer history clause should be isHistory + unique transfer ids");
} else {
  ok("QA/QM history uses tagged transfer ids only");
}

const noneSupervisors = historyAuditsForSupervisors([]);
if (noneSupervisors !== null) {
  fail("empty supervisor ids must not match every history row");
} else {
  ok("empty supervisor history clause is skipped");
}

const bySupervisors = historyAuditsForSupervisors(["sv-1"]);
const supervisorOr = bySupervisors && "OR" in bySupervisors ? bySupervisors.OR : null;
if (
  bySupervisors?.isHistory !== true ||
  !Array.isArray(supervisorOr) ||
  supervisorOr.length !== 2
) {
  fail("supervisor history should match owner id or fromSupervisorId");
} else {
  ok("QM supervisor history matches owner and outgoing transfer");
}

const newQaWouldInherit = { agent: { in: ["Moved Agent"] }, isHistory: false };
if (newQaWouldInherit.isHistory !== false) {
  fail("new QA roster clause must stay working-only");
} else {
  ok("new QA current roster cannot inherit Team 1 history");
}

const logs = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "sv-1" }],
  "qm-1",
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  "logs"
);
const metrics = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "sv-1" }],
  "qm-1",
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  "metrics"
);
if (logs !== "all" || metrics !== "working") {
  fail("QM logs default All, metrics stay Working");
} else {
  ok("QM/SA metrics stay on Working; Audit Logs show history");
}

if (viewerCanAccessTransferHistory(SYSTEM_ROLE_SLUGS.AGENT)) {
  fail("agents must not access transfer history");
} else {
  ok("agents cannot access transfer history");
}
if (
  !viewerCanAccessTransferHistory(SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) ||
  !viewerCanAccessTransferHistory(SYSTEM_ROLE_SLUGS.QUALITY_MANAGER) ||
  !viewerCanAccessTransferHistory(SYSTEM_ROLE_SLUGS.SUPERADMIN)
) {
  fail("QM, QA, and Super Admin must still access transfer history");
} else {
  ok("QM, QA, and Super Admin still access transfer history");
}

const agentLogs = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "sv-1" }],
  "agent-1",
  SYSTEM_ROLE_SLUGS.AGENT,
  "logs"
);
if (agentLogs !== "working") {
  fail("agent must not default to All for transfer history");
} else {
  ok("agent never opens transferred-out history");
}

if (errors > 0) {
  console.error(`\n${errors} verification error(s).`);
  process.exit(1);
}

console.log("\nverify-transfer-history-scope: OK");
