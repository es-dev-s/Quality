import { calculateResults } from "../lib/audit/calculate-results";
import { DEFAULT_INTERACTION_CONFIG } from "../lib/audit/seed-data";
import { getLobSubReasonOptions } from "../lib/audit/lob-flat-lists";
import {
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
  scoringMaxForTemplate,
} from "../lib/audit/rubrics";
import { getScoringOptions } from "../lib/audit/scoring-options";
import type { AuditParameter, AuditTemplate } from "../lib/audit/types";
import { defaultAuditFeedback } from "../lib/audit/feedback";

const errors: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) errors.push(msg);
}

function bestScoreValue(param: AuditParameter, isFatal: boolean): string {
  if (isFatal) return "Y";
  if (param.scoring === "EE/ME/BE/NA") return "EE";
  if (
    param.scoring === "Y/Fatal/NA" ||
    param.scoring === "Y/N/NA" ||
    param.scoring === "Y/N/Fatal/NA"
  ) {
    return String(param.points?.Y ?? param.max);
  }
  return String(param.max);
}

function verifyTemplate(template: AuditTemplate, expectedScoringParams: number) {
  const scoringParams = template.sections
    .filter((s) => !s.isFatal)
    .flatMap((s) => s.params)
    .filter((p) => p.scoring !== "Y/N-CMM");

  assert(
    scoringParams.length === expectedScoringParams,
    `${template.id}: ${expectedScoringParams} scoring parameters (got ${scoringParams.length})`
  );
  assert(
    scoringMaxForTemplate(template) === 100,
    `${template.id}: max score 100 (got ${scoringMaxForTemplate(template)})`
  );

  const cmm = template.sections.find((s) => s.name === "CMM Compliance");
  assert(
    !!cmm && cmm.params.length === 6,
    `${template.id}: 6 CMM parameters`
  );
}

assert(CALL_AUDIT_TEMPLATE.name === "Call Quality Audit", "call template name");
assert(CHAT_AUDIT_TEMPLATE.name === "Chat Quality Audit", "chat template name");
verifyTemplate(CALL_AUDIT_TEMPLATE, 23);
verifyTemplate(CHAT_AUDIT_TEMPLATE, 21);

assert(DEFAULT_INTERACTION_CONFIG.agents.length === 14, "14 agents");
assert(DEFAULT_INTERACTION_CONFIG.auditors[0] === "Belina", "auditor Belina");
assert(DEFAULT_INTERACTION_CONFIG.businessTypes.length === 2, "2 business types");
assert(DEFAULT_INTERACTION_CONFIG.lobs.length === 10, "10 LOBs");

const coreLob = DEFAULT_INTERACTION_CONFIG.lobs.find(
  (l) => l.name === "CORE LOB" && l.businessType === "Sales"
);
assert(!!coreLob?.reasons?.length, "CORE LOB has LOB-level reasons");
assert(
  getLobSubReasonOptions(coreLob).includes("C-Login Issues"),
  "sub-reason options include C-Login Issues"
);

const form = {
  agent: "Test",
  supervisor: "Manali Jadhav",
  auditor: "Belina",
  type: "Call" as const,
  businessType: "Sales" as const,
  callDate: "2026-01-01",
  auditDate: "2026-01-01",
  lob: "CORE LOB",
  sublob: "Account Management",
  mobile: "9800000000",
  reason: "C-Login Issues",
  subReason: "",
  response: "Issue resolved.",
  ...defaultAuditFeedback(),
  agentFeedback: "",
};

function perfectScoresFor(template: AuditTemplate) {
  const scores: Record<string, string> = {};
  for (const sec of template.sections) {
    for (const p of sec.params) {
      scores[p.id] = bestScoreValue(p, sec.isFatal);
    }
  }
  return scores;
}

const callPerfect = calculateResults(
  form,
  perfectScoresFor(CALL_AUDIT_TEMPLATE),
  CALL_AUDIT_TEMPLATE
);
assert(
  callPerfect.ok && callPerfect.record.qualityPct === 100,
  "call best-option score 100%"
);

const chatForm = { ...form, type: "Chat" as const };
const chatPerfect = calculateResults(
  chatForm,
  perfectScoresFor(CHAT_AUDIT_TEMPLATE),
  CHAT_AUDIT_TEMPLATE
);
assert(
  chatPerfect.ok && chatPerfect.record.qualityPct === 100,
  "chat best-option score 100%"
);

const cmm = {
  ...perfectScoresFor(CALL_AUDIT_TEMPLATE),
  "call-cmm-rude": "N",
};
const cmmResult = calculateResults(form, cmm, CALL_AUDIT_TEMPLATE);
assert(
  cmmResult.ok &&
    !cmmResult.record.hasFatal &&
    cmmResult.record.finalPct === 100,
  "CMM does not affect score"
);

const greetingOpts = getScoringOptions("Y/N/NA", 2, {
  points: { Y: 2, N: 0 },
});
assert(greetingOpts[0].label === "Y — 2", "Y matches max for Greeting");

const grammarOpts = getScoringOptions("EE/ME/BE/NA", 5, {
  points: { EE: 5, ME: 3, BE: 0 },
});
assert(grammarOpts[1].label === "ME — 3", "chat grammar ME label");

if (errors.length) {
  console.error("VERIFICATION FAILED:\n", errors.join("\n"));
  process.exit(1);
}

console.log("All spreadsheet rubric checks passed.");
