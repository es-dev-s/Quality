/**
 * Member role access / feedback mode smoke checks (no DB required for feedback;
 * scope helpers need DB when run against a live instance).
 *
 * Run: npx tsx scripts/verify-member-access.ts
 */
import {
  assertFeedbackStatusChangeAllowed,
  getFeedbackStatusSelectConfig,
} from "@/lib/audit/feedback-status-access";
import { SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import type { SessionRole } from "@/lib/rbac";

function role(slug: keyof typeof SYSTEM_ROLE_DEFINITIONS): SessionRole {
  const def = SYSTEM_ROLE_DEFINITIONS[slug];
  return {
    id: slug,
    name: def.name,
    slug,
    scopes: [...def.permissions],
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const member = role(SYSTEM_ROLE_SLUGS.MEMBER);

assert(
  member.scopes.includes("overview:read"),
  "Member has overview:read"
);
assert(
  !member.scopes.includes("audit-form:read") &&
    !member.scopes.includes("audit-form:write"),
  "Member does not have Forms access"
);
assert(
  member.scopes.includes("feedback:status"),
  "Member has feedback:status"
);

const nonePending = getFeedbackStatusSelectConfig(member, "Pending", "none");
assert(!nonePending.showSelect, "Member with zero grants hides feedback select");
assert(
  assertFeedbackStatusChangeAllowed(member, "Pending", "Shared", "none") !==
    null,
  "Member with zero grants cannot change feedback"
);

const agentShared = getFeedbackStatusSelectConfig(member, "Shared", "agent");
assert(agentShared.editable, "Member with Agent grant can respond when Shared");
assert(
  assertFeedbackStatusChangeAllowed(member, "Shared", "Acknowledged", "agent") ===
    null,
  "Member Agent mode may set Acknowledged"
);
assert(
  assertFeedbackStatusChangeAllowed(member, "Pending", "Shared", "agent") !==
    null,
  "Member Agent mode cannot share feedback"
);

const qaPending = getFeedbackStatusSelectConfig(member, "Pending", "qa");
assert(qaPending.editable, "Member with QA grant can edit Pending");
assert(
  assertFeedbackStatusChangeAllowed(member, "Pending", "Shared", "qa") === null,
  "Member QA mode may set Shared"
);
assert(
  assertFeedbackStatusChangeAllowed(member, "Shared", "Acknowledged", "qa") !==
    null,
  "Member QA mode cannot acknowledge"
);
assert(
  !getFeedbackStatusSelectConfig(member, "Acknowledged", "qa").showSelect,
  "Member QA mode has no dropdown after agent acknowledged"
);
assert(
  assertFeedbackStatusChangeAllowed(member, "Acknowledged", "Shared", "qa") !==
    null,
  "Member QA mode cannot change Acknowledged"
);

// Without memberMode, form-write must not auto-treat Member as QA.
const bare = getFeedbackStatusSelectConfig(member, "Pending");
assert(
  !bare.showSelect,
  "Member without explicit grant mode must not use QA heuristic from form write"
);

console.log("verify-member-access: ok");
