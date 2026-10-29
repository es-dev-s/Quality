import { describe, expect, it } from "vitest";
import { calculateResults } from "@/lib/audit/calculate-results";
import { buildDefaultScores } from "@/lib/audit/score-state";
import { getScoringOptions } from "@/lib/audit/scoring-options";
import { validateScoringSectionsComplete } from "@/lib/audit/scoring-form-validation";
import {
  INTRODUCED_PARAMS,
  isIntroducedParamId,
  omitIntroducedParamsForLegacyAudit,
} from "@/lib/audit/introduced-params";
import {
  sanitizeScoresForTemplate,
  templateForStoredAudit,
} from "@/lib/audit/stored-audit-template";
import {
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
  scoringMaxForTemplate,
} from "@/lib/audit/rubrics";
import { buildScoresFromFlatParamColumns } from "@/lib/import/sheet-param-map";
import {
  AUDIT_SHEET_PREVIEW_COLUMNS,
  buildAuditSheetPreview,
} from "@/lib/import/audit-sheet-columns";
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

const SALES = "Sales & Compliance";
const TEMPLATES = [
  [CALL_AUDIT_TEMPLATE, "call"],
  [CHAT_AUDIT_TEMPLATE, "chat"],
] as const;

function sales(template: AuditTemplate) {
  return template.sections.find((s) => s.name === SALES)!;
}

/** Every scoring param answered with its best value. */
function fullScores(template: AuditTemplate): ScoresMap {
  const scores: ScoresMap = { ...buildDefaultScores(template) };
  for (const section of template.sections) {
    if (section.isFatal) continue;
    for (const p of section.params) {
      if (p.scoring === "Y/N-CMM") continue;
      scores[p.id] = p.scoring === "EE/ME/BE/NA" ? "EE" : String(p.points?.Y ?? p.max);
    }
  }
  return scores;
}

/** A template as stored before Urgency Creation was introduced. */
function legacyTemplate(template: AuditTemplate): AuditTemplate {
  return {
    ...template,
    sections: template.sections.map((s) => ({
      ...s,
      params: s.params.filter((p) => !isIntroducedParamId(p.id)),
    })),
  };
}

describe("Urgency Creation in Sales & Compliance (Call + Chat)", () => {
  it.each(TEMPLATES)("%s: placed after Client Nurturing, Yes 3 / No 0, section 21", (template, prefix) => {
    const section = sales(template);
    expect(section.params.map((p) => p.id)).toEqual([
      `${prefix}-upsell`,
      `${prefix}-sales-effort`,
      `${prefix}-nurturing`,
      `${prefix}-urgency`,
    ]);
    const urgency = section.params[3];
    expect(urgency).toEqual(INTRODUCED_PARAMS.find((e) => e.param.id === urgency.id)!.param);
    expect(urgency).toMatchObject({ name: "Urgency Creation", max: 3, cat: SALES, scoring: "Y/N/NA" });
    expect(getScoringOptions(urgency.scoring, urgency.max, urgency)).toEqual([
      { label: "Y — 3", value: "3" },
      { label: "N — 0", value: "0" },
      { label: "N/A", value: "NA" },
    ]);
    expect(section.params.reduce((sum, p) => sum + p.max, 0)).toBe(21);
  });

  it("template totals: Call 100, Chat 103", () => {
    expect(scoringMaxForTemplate(CALL_AUDIT_TEMPLATE)).toBe(100);
    expect(scoringMaxForTemplate(CHAT_AUDIT_TEMPLATE)).toBe(103);
    expect(CALL_AUDIT_TEMPLATE.description).toBe("100-point call interaction rubric.");
    expect(CHAT_AUDIT_TEMPLATE.description).toBe("103-point chat interaction rubric.");
  });

  it.each(TEMPLATES)("%s: new audit — Yes scores 3 and counts in section + total", (template, prefix) => {
    const yes = fullScores(template);
    const no = { ...yes, [`${prefix}-urgency`]: "0" };
    const na = { ...yes, [`${prefix}-urgency`]: "NA" };
    const r = calculateResults({ ...form, type: template.type as "Call" | "Chat" }, yes, template);
    const rn = calculateResults(form, no, template);
    const rna = calculateResults(form, na, template);
    expect(r.ok && rn.ok && rna.ok).toBe(true);
    if (!r.ok || !rn.ok || !rna.ok) return;

    const row = r.record.rows.find((x) => x.id === `${prefix}-urgency`)!;
    expect(row).toMatchObject({ name: "Urgency Creation", cat: SALES, max: 3, sel: "3", score: 3 });
    expect(r.record.catScores[SALES]).toEqual({ scored: 21, max: 21 });
    expect(r.record.totalMax).toBe(scoringMaxForTemplate(template));
    expect(r.record.qualityPct).toBe(100);

    expect(rn.record.catScores[SALES]).toEqual({ scored: 18, max: 21 });
    expect(rn.record.totalScored).toBe(r.record.totalScored - 3);
    expect(rn.record.totalMax).toBe(r.record.totalMax);

    // N/A excludes it like every other Y/N/NA param.
    expect(rna.record.catScores[SALES]).toEqual({ scored: 18, max: 18 });
  });

  it.each(TEMPLATES)("%s: new audit form requires Urgency Creation to be rated", (template, prefix) => {
    const scores = fullScores(template);
    delete scores[`${prefix}-urgency`];
    const check = validateScoringSectionsComplete(template, scores);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.paramIds).toEqual([`${prefix}-urgency`]);
  });

  it.each(TEMPLATES)("%s: old audit edit keeps its rubric — no Urgency, score unchanged", (template, prefix) => {
    const legacy = legacyTemplate(template);
    const stored = fullScores(legacy);
    stored[`${prefix}-nurturing`] = "0";
    const original = calculateResults(form, stored, legacy);

    const editTemplate = templateForStoredAudit(template, stored);
    expect(sales(editTemplate).params.some((p) => p.id === `${prefix}-urgency`)).toBe(false);
    // Save is not blocked by an unrated new parameter.
    expect(validateScoringSectionsComplete(editTemplate, stored)).toEqual({ ok: true });

    // Even a tampered payload cannot add Urgency to an old audit.
    const payload = sanitizeScoresForTemplate({ ...stored, [`${prefix}-urgency`]: "3" }, editTemplate);
    expect(payload).not.toHaveProperty(`${prefix}-urgency`);

    const reEdited = calculateResults(form, payload, editTemplate);
    expect(original.ok && reEdited.ok).toBe(true);
    if (original.ok && reEdited.ok) {
      expect(reEdited.record.totalScored).toBe(original.record.totalScored);
      expect(reEdited.record.totalMax).toBe(original.record.totalMax);
      expect(reEdited.record.qualityPct).toBe(original.record.qualityPct);
      expect(reEdited.record.catScores).toEqual(original.record.catScores);
      expect(reEdited.record.rows).toEqual(original.record.rows);
    }
  });

  it("audits that already have Urgency Creation keep it on edit", () => {
    const stored = fullScores(CALL_AUDIT_TEMPLATE);
    stored["call-urgency"] = "0";
    expect(templateForStoredAudit(CALL_AUDIT_TEMPLATE, stored)).toBe(CALL_AUDIT_TEMPLATE);
    expect(sanitizeScoresForTemplate(stored, CALL_AUDIT_TEMPLATE)).toBe(stored);
    const r = calculateResults(form, stored, CALL_AUDIT_TEMPLATE);
    expect(r.ok && r.record.catScores[SALES]).toEqual({ scored: 18, max: 21 });
  });

  it("old Call audit with Hold and without Urgency: Hold restored, Urgency omitted", () => {
    const stored = { ...fullScores(legacyTemplate(CALL_AUDIT_TEMPLATE)), "call-hold": "0" };
    const editTemplate = templateForStoredAudit(CALL_AUDIT_TEMPLATE, stored);
    const ids = editTemplate.sections.flatMap((s) => s.params.map((p) => p.id));
    expect(ids).toContain("call-hold");
    expect(ids).not.toContain("call-urgency");
    expect(scoringMaxForTemplate(editTemplate)).toBe(100); // 97 + Hold 3, no Urgency
  });

  it("omit is a no-op for templates without Urgency (e.g. custom templates)", () => {
    const custom = legacyTemplate(CHAT_AUDIT_TEMPLATE);
    expect(omitIntroducedParamsForLegacyAudit(custom, {})).toBe(custom);
  });

  it("sheet import maps an optional \"Urgency Creation\" column", () => {
    const call = buildScoresFromFlatParamColumns({ "Urgency Creation": "Yes", Greeting: "Y" }, CALL_AUDIT_TEMPLATE);
    expect(call.scores["call-urgency"]).toBe("3");
    const chat = buildScoresFromFlatParamColumns({ "urgency creation": "No" }, CHAT_AUDIT_TEMPLATE);
    expect(chat.scores).toEqual({ "chat-urgency": "0" });
    const without = buildScoresFromFlatParamColumns({ Greeting: "Y" }, CALL_AUDIT_TEMPLATE);
    expect(without.scores).not.toHaveProperty("call-urgency");

    // Appended last so positional mapping of older sheets is unchanged.
    expect(AUDIT_SHEET_PREVIEW_COLUMNS.at(-1)).toBe("Urgency Creation");
    expect(AUDIT_SHEET_PREVIEW_COLUMNS.at(-2)).toBe("Call Length");
    const preview = buildAuditSheetPreview({
      "Call Date": "2026-01-01",
      "Audit Date": "2026-01-02",
      "Agent Name": "A",
      LOB: "CORE LOB",
      "Call/Chat": "Call",
      "Urgency Creation": "Yes",
    });
    expect(preview["Urgency Creation"]).toBe("Yes");
  });
});
