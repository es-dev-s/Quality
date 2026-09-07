import {
  AUDIT_FORM_ACCESS_ROLES,
  FORM_SUPERVISOR_AGENT_RULES,
} from "@/lib/audit/form-supervisor-agents";
import { isSupervisorTierRole } from "@/lib/audit/supervisor-tier";
import {
  PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_SLUGS,
} from "@/lib/permissions";
import { mergeRosterIntoFilterOptions, extractFilterOptions } from "@/lib/audit/dashboard-metrics";
import { defaultAuditHistoryFilter } from "@/lib/audit/history-filter";
import { resolveDisplayedAuditTargetOwnerId } from "@/lib/kpi/audit-target-owner";

let errors = 0;

function fail(message: string) {
  console.error(`FAIL: ${message}`);
  errors += 1;
}

function ok(message: string) {
  console.log(`OK: ${message}`);
}

console.log("=== Agent transfer + training supervisor verification ===\n");

const trainingDef = SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR];
const supervisorDef = SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLE_SLUGS.SUPERVISOR];

if (!trainingDef.permissions.includes(PERMISSIONS.AUDIT_FORM_READ)) {
  fail("training-supervisor missing audit-form:read");
} else {
  ok("training-supervisor has audit-form:read");
}

if (!trainingDef.permissions.includes(PERMISSIONS.AUDIT_FORM_WRITE)) {
  fail("training-supervisor missing audit-form:write");
} else {
  ok("training-supervisor has audit-form:write");
}

if (!supervisorDef.permissions.includes(PERMISSIONS.AUDIT_FORM_READ)) {
  fail("standard supervisor missing audit-form:read");
} else {
  ok("standard supervisor has audit-form:read");
}

if (!supervisorDef.permissions.includes(PERMISSIONS.AUDIT_FORM_WRITE)) {
  fail("standard supervisor missing audit-form:write");
} else {
  ok("standard supervisor has audit-form:write");
}

if (!AUDIT_FORM_ACCESS_ROLES.includes(SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR)) {
  fail("training-supervisor not in AUDIT_FORM_ACCESS_ROLES");
} else {
  ok("training-supervisor in AUDIT_FORM_ACCESS_ROLES");
}

if (!AUDIT_FORM_ACCESS_ROLES.includes(SYSTEM_ROLE_SLUGS.SUPERVISOR)) {
  fail("standard supervisor not in AUDIT_FORM_ACCESS_ROLES");
} else {
  ok("standard supervisor in AUDIT_FORM_ACCESS_ROLES");
}

const trainingRules = FORM_SUPERVISOR_AGENT_RULES[SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR];
if (!trainingRules.canAccessForm) {
  fail("training-supervisor form rules should allow form access");
} else {
  ok("training-supervisor form scope configured");
}

const supervisorRules = FORM_SUPERVISOR_AGENT_RULES[SYSTEM_ROLE_SLUGS.SUPERVISOR];
if (!supervisorRules.canAccessForm) {
  fail("standard supervisor form rules should allow form access");
} else {
  ok("standard supervisor form scope configured");
}

if (!isSupervisorTierRole(SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR)) {
  fail("training-supervisor should be supervisor-tier");
} else {
  ok("training-supervisor is supervisor-tier");
}

const merged = mergeRosterIntoFilterOptions(
  extractFilterOptions([]),
  ["Agent After Transfer"]
);
if (!merged.agents.includes("Agent After Transfer")) {
  fail("mergeRosterIntoFilterOptions should include roster-only agents");
} else {
  ok("dashboard/analytics filters include roster-only agents");
}

const teamScoped = extractFilterOptions([
  {
    id: "1",
    auditCode: "A-1",
    agent: "Agent A",
    supervisor: "Team North",
    auditor: "QA 1",
    lob: "Sales",
    type: "Call",
    businessType: "Sales",
    callDate: "2026-06-01",
    auditDate: "2026-06-01",
    qualityPct: 80,
    finalPct: 80,
    hasFatal: false,
    fatalList: [],
  },
  {
    id: "2",
    auditCode: "A-2",
    agent: "Agent B",
    supervisor: "Team South",
    auditor: "QA 1",
    lob: "Sales",
    type: "Call",
    businessType: "Sales",
    callDate: "2026-06-01",
    auditDate: "2026-06-01",
    qualityPct: 80,
    finalPct: 80,
    hasFatal: false,
    fatalList: [],
  },
]);
if (
  teamScoped.agentsByTeam["Team North"]?.join(",") !== "Agent A" ||
  teamScoped.agentsByTeam["Team South"]?.join(",") !== "Agent B"
) {
  fail("extractFilterOptions should map agents to their team");
} else {
  ok("dashboard filters map agents to the selected team");
}

console.log("");

const ownedHistory = defaultAuditHistoryFilter(
  [
    { isHistory: false, historyOwnerId: null },
    { isHistory: true, historyOwnerId: "supervisor-1" },
  ],
  "supervisor-1",
  SYSTEM_ROLE_SLUGS.SUPERVISOR
);
if (ownedHistory !== "all") {
  fail("previous supervisor should default to All so transferred-agent history is visible");
} else {
  ok("previous supervisor defaults to All when they own transfer history");
}

const trainingHistory = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "training-1",
  SYSTEM_ROLE_SLUGS.TRAINING_SUPERVISOR
);
if (trainingHistory !== "all") {
  fail("training supervisor should default to All for owned transfer history");
} else {
  ok("training supervisor defaults to All when they have transfer history");
}

const qaHistory = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "qa-1",
  SYSTEM_ROLE_SLUGS.QUALITY_ANALYST
);
if (qaHistory !== "all") {
  fail("QA should default to All so transferred-member audits they already scoped stay visible");
} else {
  ok("QA defaults to All when transferred-member history is in their scope");
}

const agentHistory = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "agent-1",
  SYSTEM_ROLE_SLUGS.AGENT
);
if (agentHistory !== "all") {
  fail("agent should default to All so their own transferred-team audits stay visible");
} else {
  ok("agent defaults to All when history is in their scope");
}

const memberHistory = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "member-1",
  SYSTEM_ROLE_SLUGS.MEMBER
);
if (memberHistory !== "all") {
  fail("member should default to All for granted QA/agent history already in scope");
} else {
  ok("member defaults to All when granted history is in their scope");
}

const qmWorking = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "qm-1",
  SYSTEM_ROLE_SLUGS.QUALITY_MANAGER
);
if (qmWorking !== "working") {
  fail("quality manager should stay on Working by default");
} else {
  ok("quality manager stays on Working by default");
}

const superadminWorking = defaultAuditHistoryFilter(
  [{ isHistory: true, historyOwnerId: "supervisor-1" }],
  "sa-1",
  SYSTEM_ROLE_SLUGS.SUPERADMIN
);
if (superadminWorking !== "working") {
  fail("super admin should stay on Working by default");
} else {
  ok("super admin stays on Working by default");
}

const qaSeesQmTarget = resolveDisplayedAuditTargetOwnerId({
  viewerUserId: "qa-1",
  viewerRoleSlug: SYSTEM_ROLE_SLUGS.QUALITY_ANALYST,
  createdById: "qm-1",
  createdByRoleSlug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
});
if (qaSeesQmTarget !== "qm-1") {
  fail("QA should display the Quality Manager's per-agent audit target");
} else {
  ok("QA dashboard target owner is the creating Quality Manager");
}

const qmKeepsOwnTarget = resolveDisplayedAuditTargetOwnerId({
  viewerUserId: "qm-1",
  viewerRoleSlug: SYSTEM_ROLE_SLUGS.QUALITY_MANAGER,
  createdById: "sa-1",
  createdByRoleSlug: SYSTEM_ROLE_SLUGS.SUPERADMIN,
});
if (qmKeepsOwnTarget !== "qm-1") {
  fail("Quality Manager should keep their own per-agent audit target");
} else {
  ok("Quality Manager target owner stays themselves");
}

console.log("");
if (errors > 0) {
  console.error(`${errors} verification error(s).`);
  process.exit(1);
}

console.log("All agent transfer + training supervisor checks passed.");
