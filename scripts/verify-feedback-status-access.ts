/**
 * Feedback status RBAC regression checks.
 * Run: npx tsx scripts/verify-feedback-status-access.ts
 */
import {
  AGENT_FEEDBACK_STATUSES,
  assertFeedbackStatusChangeAllowed,
  getFeedbackStatusSelectConfig,
  QA_FEEDBACK_STATUSES,
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

const qa = role(SYSTEM_ROLE_SLUGS.QUALITY_ANALYST);
const qm = role(SYSTEM_ROLE_SLUGS.QUALITY_MANAGER);
const agent = role(SYSTEM_ROLE_SLUGS.AGENT);

const qaPending = getFeedbackStatusSelectConfig(qa, "Pending");
assert(qaPending.editable, "QA can edit Pending");
assert(qaPending.showSelect, "QA sees dropdown for Pending");
assert(qaPending.selectValue === "Pending", "QA Pending dropdown shows Pending");
assert(
  qaPending.options.every((option) => QA_FEEDBACK_STATUSES.includes(option.value)),
  "QA options limited to Pending/Shared"
);

const qaShared = getFeedbackStatusSelectConfig(qa, "Shared");
assert(qaShared.editable, "QA can edit Shared");
assert(qaShared.selectValue === "Shared", "QA Shared dropdown shows Shared");

const qaAck = getFeedbackStatusSelectConfig(qa, "Acknowledged");
assert(!qaAck.showSelect, "QA has no dropdown once agent acknowledged");
assert(!qaAck.editable, "QA cannot edit Acknowledged");
assert(qaAck.selectValue === "Acknowledged", "QA still displays Acknowledged");

const agentPending = getFeedbackStatusSelectConfig(agent, "Pending");
assert(!agentPending.editable, "Agent cannot edit Pending");
assert(agentPending.showSelect, "Agent sees global Pending in dropdown");
assert(agentPending.selectValue === "Pending", "Agent Pending shows global status");

const agentShared = getFeedbackStatusSelectConfig(agent, "Shared");
assert(agentShared.editable, "Agent can respond when Shared");
assert(agentShared.selectValue === "Shared", "Agent dropdown shows global Shared");
assert(
  agentShared.options.some((option) => option.value === "Shared" && option.disabled),
  "Agent Shared shown as current disabled option"
);
assert(
  agentShared.options.some((option) => option.value === "Acknowledged" && !option.disabled),
  "Agent can pick Acknowledged from single dropdown"
);

assert(
  assertFeedbackStatusChangeAllowed(qa, "Pending", "Shared") === null,
  "QA Pending→Shared allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(qa, "Shared", "Pending") === null,
  "QA Shared→Pending allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(qa, "Acknowledged", "Pending") !== null,
  "QA cannot change Acknowledged"
);
assert(
  assertFeedbackStatusChangeAllowed(qa, "Disputed", "Shared") === null,
  "QA Disputed→Shared allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(qa, "Pending", "Acknowledged") !== null,
  "QA cannot set Acknowledged"
);

const qmAck = getFeedbackStatusSelectConfig(qm, "Acknowledged");
assert(!qmAck.showSelect, "QM has no dropdown once agent acknowledged");
assert(!qmAck.editable, "QM cannot edit Acknowledged");
assert(
  assertFeedbackStatusChangeAllowed(qm, "Acknowledged", "Pending") !== null,
  "QM cannot change Acknowledged"
);
assert(
  assertFeedbackStatusChangeAllowed(qm, "Pending", "Shared") === null,
  "QM Pending→Shared allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(agent, "Shared", "Acknowledged") === null,
  "Agent Shared→Acknowledged allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(agent, "Pending", "Disputed") !== null,
  "Agent cannot respond from Pending"
);
assert(
  assertFeedbackStatusChangeAllowed(agent, "Shared", "Pending") !== null,
  "Agent cannot revert to Pending"
);

console.log("verify-feedback-status-access: OK");
