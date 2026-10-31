import { describe, expect, it } from "vitest";
import { calculateResults } from "@/lib/audit/calculate-results";
import { buildDefaultScores } from "@/lib/audit/score-state";
import { getScoringOptions } from "@/lib/audit/scoring-options";
import { isScoringFatal } from "@/lib/audit/resolve-score";
import {
  normalizeFatalYnScoreValue,
  patchTemplateFatalYnParams,
  templateSectionsHaveFormerFatalYnParams,
} from "@/lib/audit/fatal-yn-params";
import {
  hasLegacyFatalSelection,
  isLegacyFatalParamDefinition,
  storedRowsFromRecord,
} from "@/lib/audit/legacy-fatal-params";
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
import { defaultAuditFeedback } from "@/lib/audit/feedback";
import type {
  AuditFormData,
  AuditParameter,
  AuditTemplate,
  ScoresMap,
} from "@/lib/audit/types";

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

const TAGGING = ["call-alltagged", "call-correcttag"] as const;

function param(template: AuditTemplate, id: string): AuditParameter {
  return template.sections.flatMap((s) => s.params).find((p) => p.id === id)!;
}

function fullScores(template: AuditTemplate): ScoresMap {
  const scores = buildDefaultScores(template);
  for (const section of template.sections) {
    if (section.isFatal) continue;
    for (const p of section.params) {
      if (p.scoring === "Y/N-CMM") continue;
      scores[p.id] =
        p.scoring === "EE/ME/BE/NA" ? "EE" : String(p.points?.Y ?? p.max);
    }
  }
  return scores;
}

function score(template: AuditTemplate, scores: ScoresMap) {
  const result = calculateResults(form, scores, template);
  if (!result.ok) throw new Error(result.error);
  return result.record;
}

/** The Call template as stored before this change (tagging was Y/Fatal/NA). */
const LEGACY_STORED_CALL: AuditTemplate = {
  ...CALL_AUDIT_TEMPLATE,
  sections: CALL_AUDIT_TEMPLATE.sections.map((section) => ({
    ...section,
    params: section.params.map((p) =>
      (TAGGING as readonly string[]).includes(p.id)
        ? {
            ...p,
            scoring: "Y/Fatal/NA" as const,
            points: { Y: p.max },
            fatalOptionLabel: "FATAL",
          }
        : p
    ),
  })),
};

describe("Call Disposition tagging: Y / N / N/A (Yes 5 / No 0), no FATAL", () => {
  it("uses the standard Y/N/NA answer type with Y — 5 / N — 0 / N/A", () => {
    for (const id of TAGGING) {
      const p = param(CALL_AUDIT_TEMPLATE, id);
      expect(p.scoring).toBe("Y/N/NA");
      expect(p.points).toEqual({ Y: 5, N: 0 });
      expect(p.fatalOptionLabel).toBeUndefined();
      expect(getScoringOptions(p.scoring, p.max, p)).toEqual([
        { label: "Y — 5", value: "5" },
        { label: "N — 0", value: "0" },
        { label: "N/A", value: "NA" },
      ]);
    }
  });

  it("keeps the template totals (Call 100) and Chat tagging unchanged", () => {
    expect(scoringMaxForTemplate(CALL_AUDIT_TEMPLATE)).toBe(100);
    for (const id of ["chat-alltagged", "chat-correcttag"]) {
      const p = param(CHAT_AUDIT_TEMPLATE, id);
      expect(p.scoring).toBe("Y/Fatal/NA");
      expect(p.fatalOptionLabel).toBe("FATAL");
    }
  });

  it("No = 0 counts in Call Disposition and the quality %, never fatal", () => {
    const record = score(CALL_AUDIT_TEMPLATE, {
      ...fullScores(CALL_AUDIT_TEMPLATE),
      "call-alltagged": "0",
    });
    expect(record.hasFatal).toBe(false);
    expect(record.fatalList).toEqual([]);
    expect(record.catScores["Call Disposition"]).toEqual({ scored: 5, max: 10 });
    expect(record.totalScored).toBe(95);
    expect(record.totalMax).toBe(100);
    expect(record.qualityPct).toBe(95);
    expect(record.finalPct).toBe(95);
    expect(record.rows.find((r) => r.id === "call-alltagged")).toMatchObject({
      sel: "0",
      score: 0,
      fatal: false,
    });
  });

  it("N/A is excluded from the total", () => {
    const record = score(CALL_AUDIT_TEMPLATE, {
      ...fullScores(CALL_AUDIT_TEMPLATE),
      "call-correcttag": "NA",
    });
    expect(record.catScores["Call Disposition"]).toEqual({ scored: 5, max: 5 });
    expect(record.totalMax).toBe(95);
    expect(record.qualityPct).toBe(100);
  });

  it("a FATAL value on a new audit is stored as No = 0 and is not fatal", () => {
    const tampered = {
      ...fullScores(CALL_AUDIT_TEMPLATE),
      "call-correcttag": "Fatal",
    };
    expect(isScoringFatal(param(CALL_AUDIT_TEMPLATE, "call-correcttag"), "Fatal")).toBe(false);
    const clean = sanitizeScoresForTemplate(tampered, CALL_AUDIT_TEMPLATE);
    expect(clean["call-correcttag"]).toBe("0");
    const record = score(CALL_AUDIT_TEMPLATE, clean);
    expect(record.hasFatal).toBe(false);
    expect(record.qualityPct).toBe(95);
  });

  it("read-time repair turns a stored fatal definition into Y/N/NA (Call only)", () => {
    expect(templateSectionsHaveFormerFatalYnParams(LEGACY_STORED_CALL.sections)).toBe(true);
    const patched = patchTemplateFatalYnParams(LEGACY_STORED_CALL);
    expect(templateSectionsHaveFormerFatalYnParams(patched.sections)).toBe(false);
    for (const id of TAGGING) {
      expect(param(patched, id)).toEqual(param(CALL_AUDIT_TEMPLATE, id));
    }
    // Remaining FATAL params are still forced to FATAL.
    expect(param(patched, "call-correct").scoring).toBe("Y/Fatal/NA");
    expect(
      param(patchTemplateFatalYnParams(CHAT_AUDIT_TEMPLATE), "chat-alltagged").scoring
    ).toBe("Y/Fatal/NA");
    // Already-migrated templates are left alone.
    expect(templateSectionsHaveFormerFatalYnParams(CALL_AUDIT_TEMPLATE.sections)).toBe(false);
  });

  it("an old audit with FATAL keeps the legacy FATAL option and identical score on edit", () => {
    const oldScores = {
      ...fullScores(LEGACY_STORED_CALL),
      "call-correcttag": "Fatal",
    };
    const original = score(LEGACY_STORED_CALL, oldScores);
    expect(original.hasFatal).toBe(true);
    expect(original.finalPct).toBe(0);

    const editTemplate = templateForStoredAudit(
      CALL_AUDIT_TEMPLATE,
      oldScores,
      original.rows
    );
    const legacy = param(editTemplate, "call-correcttag");
    expect(isLegacyFatalParamDefinition(legacy)).toBe(true);
    expect(getScoringOptions(legacy.scoring, legacy.max, legacy).map((o) => o.label)).toEqual([
      "Y — 5",
      "FATAL",
      "N/A",
    ]);
    // Untouched sibling stays on the new Y/N/NA definition.
    expect(param(editTemplate, "call-alltagged").scoring).toBe("Y/N/NA");

    const resaved = score(editTemplate, sanitizeScoresForTemplate(oldScores, editTemplate));
    expect(resaved.hasFatal).toBe(true);
    expect(resaved.finalPct).toBe(original.finalPct);
    expect(resaved.qualityPct).toBe(original.qualityPct);
    expect(resaved.catScores).toEqual(original.catScores);
    expect(resaved.grade).toBe(original.grade);
  });

  it("a pre-Fatal legacy '0' stored as a fatal row is still FATAL on edit", () => {
    const oldScores = { ...fullScores(CALL_AUDIT_TEMPLATE), "call-alltagged": "0" };
    const rows = storedRowsFromRecord({
      rows: [{ id: "call-alltagged", fatal: true, sel: "0" }],
    });
    expect(hasLegacyFatalSelection("call-alltagged", oldScores, rows)).toBe(true);
    const editTemplate = templateForStoredAudit(CALL_AUDIT_TEMPLATE, oldScores, rows);
    const legacy = param(editTemplate, "call-alltagged");
    expect(normalizeFatalYnScoreValue(legacy, "0")).toBe("Fatal");
    const record = score(editTemplate, oldScores);
    expect(record.hasFatal).toBe(true);
    expect(record.finalPct).toBe(0);
  });

  it("old audits with Y / N/A / non-fatal 0 edit on Y/N/NA with the same score", () => {
    for (const value of ["5", "NA", "0"]) {
      const oldScores = { ...fullScores(CALL_AUDIT_TEMPLATE), "call-alltagged": value };
      const rows = [{ id: "call-alltagged", fatal: false }];
      const editTemplate = templateForStoredAudit(CALL_AUDIT_TEMPLATE, oldScores, rows);
      expect(param(editTemplate, "call-alltagged").scoring).toBe("Y/N/NA");
      expect(score(editTemplate, oldScores).hasFatal).toBe(false);
    }
  });

  it("a new audit saved with No = 0 is not treated as legacy FATAL later", () => {
    const scores = { ...fullScores(CALL_AUDIT_TEMPLATE), "call-correcttag": "0" };
    const saved = score(CALL_AUDIT_TEMPLATE, scores);
    const editTemplate = templateForStoredAudit(CALL_AUDIT_TEMPLATE, scores, saved.rows);
    expect(editTemplate).toBe(CALL_AUDIT_TEMPLATE);
    expect(score(editTemplate, scores).qualityPct).toBe(saved.qualityPct);
  });

  it("sheet import: Yes / No / N/A map to 5 / 0 / NA; an explicit FATAL keeps the legacy fatal row", () => {
    const yes = buildScoresFromFlatParamColumns(
      { "All Queries Tagged": "Yes", "Correct Tagging": "No" },
      CALL_AUDIT_TEMPLATE
    );
    expect(yes.scores["call-alltagged"]).toBe("5");
    expect(yes.scores["call-correcttag"]).toBe("0");

    const na = buildScoresFromFlatParamColumns({ "Correct Tagging": "N/A" }, CALL_AUDIT_TEMPLATE);
    expect(na.scores["call-correcttag"]).toBe("NA");

    const fatal = buildScoresFromFlatParamColumns(
      { "Correct Tagging": "FATAL" },
      CALL_AUDIT_TEMPLATE
    );
    expect(fatal.scores["call-correcttag"]).toBe("Fatal");
    const scores = { ...fullScores(CALL_AUDIT_TEMPLATE), ...fatal.scores };
    const imported = score(
      templateForStoredAudit(CALL_AUDIT_TEMPLATE, scores, fatal.auditRows),
      scores
    );
    expect(imported.hasFatal).toBe(true);
    expect(imported.finalPct).toBe(0);
  });
});
