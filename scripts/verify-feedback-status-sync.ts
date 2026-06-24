/**
 * Feedback status transition regression checks.
 * Run: npx tsx scripts/verify-feedback-status-sync.ts
 */
import { resolveStatusTimestamps } from "@/lib/audit/feedback-datetime";
import { applyFeedbackStatusChange } from "@/components/audit-logs/feedback-status-datetime";
import { getFeedbackStatusSelectConfig } from "@/lib/audit/feedback-status-access";
import { SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import type { AuditLogEntry } from "@/lib/audit/audit-records";
import type { SessionRole } from "@/lib/rbac";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function role(slug: keyof typeof SYSTEM_ROLE_DEFINITIONS): SessionRole {
  const def = SYSTEM_ROLE_DEFINITIONS[slug];
  return {
    id: slug,
    name: def.name,
    slug,
    scopes: [...def.permissions],
  };
}

const agent = role(SYSTEM_ROLE_SLUGS.AGENT);

const row = (feedbackStatus: AuditLogEntry["feedbackStatus"]): AuditLogEntry =>
  ({
    id: "audit-1",
    auditCode: "AUD-1",
    agent: "Test Agent",
    supervisor: null,
    lob: "LOB",
    sublob: null,
    reason: null,
    type: "Call",
    businessType: "Inbound",
    callDate: "2026-01-01",
    auditDate: "2026-01-02",
    auditor: "QA",
    qualityPct: 90,
    finalPct: 90,
    grade: "Excellent",
    hasFatal: false,
    feedbackSecurity: "NA",
    feedbackStatus,
    feedbackDate: "2026-01-02T10:00:00.000Z",
    feedbackStatusAt: "2026-01-03T10:00:00.000Z",
    agentFeedback: "Note",
    supervisorRemarks: "",
    mobile: null,
    referenceUrl: null,
    submittedBy: "QA",
    createdAt: "2026-01-02T10:00:00.000Z",
  }) as AuditLogEntry;

const qaResetPending = resolveStatusTimestamps({
  feedbackStatus: "Pending",
  feedbackDate: "",
  feedbackStatusAt: "",
  previousStatus: "Acknowledged",
  existingFeedbackDate: row("Acknowledged").feedbackDate,
  existingFeedbackStatusAt: row("Acknowledged").feedbackStatusAt,
});
assert(
  qaResetPending.feedbackDate === null && qaResetPending.feedbackStatusAt === null,
  "QA Pending clears shared/agent timestamps"
);

const qaReShare = resolveStatusTimestamps({
  feedbackStatus: "Shared",
  feedbackDate: "",
  feedbackStatusAt: "",
  previousStatus: "Acknowledged",
  existingFeedbackDate: row("Acknowledged").feedbackDate,
  existingFeedbackStatusAt: row("Acknowledged").feedbackStatusAt,
});
assert(
  qaReShare.feedbackStatusAt === null,
  "QA Shared after Acknowledged clears agent response timestamp"
);

const clientSharedReset = applyFeedbackStatusChange(row("Acknowledged"), "Shared");
assert(
  clientSharedReset.feedbackStatus === "Shared" &&
    clientSharedReset.feedbackStatusAt === null,
  "Client optimistic Shared clears agent response timestamp"
);

const agentPendingUi = getFeedbackStatusSelectConfig(agent, "Pending");
assert(agentPendingUi.showSelect, "Agent sees Pending in unified dropdown");
assert(!agentPendingUi.editable, "Agent cannot change Pending");
assert(agentPendingUi.selectValue === "Pending", "Agent Pending display uses global status");

const agentSharedUi = getFeedbackStatusSelectConfig(agent, "Shared");
assert(agentSharedUi.showSelect, "Agent can respond when Shared");
assert(
  agentSharedUi.options.some(
    (option) => option.value === "Shared" && option.disabled
  ),
  "Agent dropdown shows global Shared as current option"
);

console.log("verify-feedback-status-sync: OK");
