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
const agent = role(SYSTEM_ROLE_SLUGS.AGENT);

const qaPending = getFeedbackStatusSelectConfig(qa, "Pending");
assert(qaPending.editable, "QA can edit Pending");
assert(
  qaPending.options.every((option) => QA_FEEDBACK_STATUSES.includes(option.value)),
  "QA options limited to Pending/Shared"
);

const qaAck = getFeedbackStatusSelectConfig(qa, "Acknowledged");
assert(!qaAck.editable, "QA cannot edit Acknowledged");

const agentPending = getFeedbackStatusSelectConfig(agent, "Pending");
assert(!agentPending.editable, "Agent cannot edit Pending");
assert(!agentPending.showSelect, "Agent sees readonly Pending");

const agentShared = getFeedbackStatusSelectConfig(agent, "Shared");
assert(agentShared.editable, "Agent can respond when Shared");
assert(Boolean(agentShared.awaitingResponse), "Agent keeps Shared visible while responding");
assert(agentShared.selectValue === "", "Agent response picker starts empty");
assert(
  agentShared.options.every((option) =>
    AGENT_FEEDBACK_STATUSES.includes(option.value)
  ),
  "Agent options limited to Acknowledged/Disputed"
);

assert(
  assertFeedbackStatusChangeAllowed(qa, "Pending", "Shared") === null,
  "QA Pending→Shared allowed"
);
assert(
  assertFeedbackStatusChangeAllowed(qa, "Pending", "Acknowledged") !== null,
  "QA cannot set Acknowledged"
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
