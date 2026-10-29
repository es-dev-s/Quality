import { describe, expect, it } from "vitest";
import { calculateResults } from "@/lib/audit/calculate-results";
import { buildDefaultScores } from "@/lib/audit/score-state";
import {
  isRetiredParamId,
  removeRetiredTemplateParams,
  restoreRetiredParamsForEdit,
  stripRetiredScores,
  templateSectionsHaveRetiredParams,
} from "@/lib/audit/retired-params";
import {
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
  scoringMaxForTemplate,
} from "@/lib/audit/rubrics";
import { buildScoresFromFlatParamColumns } from "@/lib/import/sheet-param-map";
import { defaultAuditFeedback } from "@/lib/audit/feedback";
import type { AuditFormData, AuditTemplate, ScoresMap } from "@/lib/audit/types";

const form: AuditFormData = {
  agent: "Test",
  supervisor: "Sup",
  auditor: "Auditor",
  type: "Call",
  auditType: "BAU Audit",
  businessType: "Sales",
  callDate: "2026-01-01",
  auditDate: "2026-01-01",
  lob: "CORE LOB",
  sublob: "Account Management",
  mobile: "9800000000",
  callDuration: "04:35",
  referenceUrl: "https://crm.example.com/ticket/1",
  reason: "C-Login Issues",
  subReason: "",
  response: "ok",
  ...defaultAuditFeedback(),
  agentFeedback: "",
};

/** The Call template as it was stored before Hold was retired. */
function legacyCallTemplate(): AuditTemplate {
  return {
    ...CALL_AUDIT_TEMPLATE,
    sections: CALL_AUDIT_TEMPLATE.sections.map((section) => {
      if (section.id !== "call-compliance") return section;
      const params = [...section.params];
      const at = params.findIndex((p) => p.id === "call-closing") + 1;
      params.splice(at, 0, {
        id: "call-hold",
        name: "Hold (<=1min 3x)",
        max: 3,
        cat: "Call Compliance",
        scoring: "Y/N/NA",
        points: { Y: 3, N: 0 },
      });
      return { ...section, params };
    }),
  };
}

function compliance(template: AuditTemplate) {
  return template.sections.find((s) => s.id === "call-compliance")!;
}

describe("Call Hold parameter retired", () => {
  it("is not in the built-in Call template; Call Compliance = 11 (total 100 incl. Urgency Creation)", () => {
    const section = compliance(CALL_AUDIT_TEMPLATE);
    expect(section.params.map((p) => p.id)).toEqual([
      "call-greeting",
      "call-permission",
      "call-closing",
      "call-followup",
    ]);
    expect(section.params.reduce((sum, p) => sum + p.max, 0)).toBe(11);
    expect(scoringMaxForTemplate(CALL_AUDIT_TEMPLATE)).toBe(100);
    expect(templateSectionsHaveRetiredParams(CALL_AUDIT_TEMPLATE.sections)).toBe(false);
  });

  it("leaves the Chat template (Response Time) untouched", () => {
    expect(scoringMaxForTemplate(CHAT_AUDIT_TEMPLATE)).toBe(103);
    expect(removeRetiredTemplateParams(CHAT_AUDIT_TEMPLATE)).toBe(CHAT_AUDIT_TEMPLATE);
  });

  it("strips Hold from a stored (legacy) template at read time", () => {
    const legacy = legacyCallTemplate();
    expect(scoringMaxForTemplate(legacy)).toBe(103);
    const patched = removeRetiredTemplateParams(legacy);
    expect(compliance(patched).params.some((p) => p.id === "call-hold")).toBe(false);
    expect(scoringMaxForTemplate(patched)).toBe(100);
  });

  it("new audit: a payload that still contains Hold is ignored", () => {
    const scores: ScoresMap = { ...buildDefaultScores(CALL_AUDIT_TEMPLATE) };
    for (const section of CALL_AUDIT_TEMPLATE.sections) {
      if (section.isFatal) continue;
      for (const p of section.params) if (p.scoring === "Y/N/NA") scores[p.id] = String(p.max);
    }
    const withHold = { ...scores, "call-hold": "0" };
    const stripped = stripRetiredScores(withHold, CALL_AUDIT_TEMPLATE);
    expect(stripped).not.toHaveProperty("call-hold");

    const a = calculateResults(form, withHold, CALL_AUDIT_TEMPLATE);
    const b = calculateResults(form, scores, CALL_AUDIT_TEMPLATE);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.record.totalMax).toBe(b.record.totalMax);
      expect(a.record.qualityPct).toBe(b.record.qualityPct);
      expect(a.record.rows.some((r) => r.id === "call-hold")).toBe(false);
    }
  });

  it("old audit edit: Hold is restored from the stored value, score unchanged", () => {
    const legacy = legacyCallTemplate();
    const stored: ScoresMap = { ...buildDefaultScores(legacy) };
    for (const section of legacy.sections) {
      if (section.isFatal) continue;
      for (const p of section.params) if (p.scoring === "Y/N/NA") stored[p.id] = String(p.max);
    }
    stored["call-hold"] = "0";
    const original = calculateResults(form, stored, legacy);

    const editTemplate = restoreRetiredParamsForEdit(CALL_AUDIT_TEMPLATE, stored);
    expect(compliance(editTemplate).params.map((p) => p.id)).toEqual([
      "call-greeting",
      "call-permission",
      "call-closing",
      "call-hold",
      "call-followup",
    ]);
    const reEdited = calculateResults(form, stripRetiredScores(stored, editTemplate), editTemplate);
    expect(original.ok && reEdited.ok).toBe(true);
    if (original.ok && reEdited.ok) {
      expect(reEdited.record.totalScored).toBe(original.record.totalScored);
      expect(reEdited.record.totalMax).toBe(original.record.totalMax);
      expect(reEdited.record.qualityPct).toBe(original.record.qualityPct);
      expect(reEdited.record.catScores["Call Compliance"]).toEqual(
        original.record.catScores["Call Compliance"]
      );
    }
  });

  it("audits without a stored Hold value never gain it on edit", () => {
    const scores = buildDefaultScores(CALL_AUDIT_TEMPLATE);
    expect(restoreRetiredParamsForEdit(CALL_AUDIT_TEMPLATE, scores)).toBe(CALL_AUDIT_TEMPLATE);
    expect(restoreRetiredParamsForEdit(CALL_AUDIT_TEMPLATE, { "call-hold": "" })).toBe(
      CALL_AUDIT_TEMPLATE
    );
    expect(restoreRetiredParamsForEdit(CHAT_AUDIT_TEMPLATE, { "call-hold": "3" })).toBe(
      CHAT_AUDIT_TEMPLATE
    );
    expect(isRetiredParamId("call-hold")).toBe(true);
    expect(isRetiredParamId("call-followup")).toBe(false);
  });

  it("sheet import ignores a Hold column and still maps Response Time for Chat", () => {
    const call = buildScoresFromFlatParamColumns(
      { "Hold (<=1min 3x)": "Y", "Response Time <10s": "Y", Greeting: "Y" },
      CALL_AUDIT_TEMPLATE
    );
    expect(call.scores).not.toHaveProperty("call-hold");
    expect(call.scores["call-greeting"]).toBe("2");

    const chat = buildScoresFromFlatParamColumns(
      { "Response Time <10s": "Y" },
      CHAT_AUDIT_TEMPLATE
    );
    expect(Object.values(chat.scores)).toEqual(["8"]);
  });
});
