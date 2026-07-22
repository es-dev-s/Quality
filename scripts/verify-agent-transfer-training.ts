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

console.log("");
if (errors > 0) {
  console.error(`${errors} verification error(s).`);
  process.exit(1);
}

console.log("All agent transfer + training supervisor checks passed.");
