import type { AuditParameter, AuditTemplate, ScoresMap } from "@/lib/audit/types";

/**
 * Parameters added to a rubric after audits were already being recorded.
 * New audits score them like every other parameter. Audits saved before the
 * parameter existed have no stored value for it: they keep displaying their
 * original rows / totals / quality %, and editing such an audit keeps the
 * rubric it was scored on (the new parameter is left out for that audit), so
 * saving it never silently changes its score or blocks on an unrated field.
 */
type IntroducedParam = {
  /** Built-in template the parameter was added to. */
  templateId: string;
  /** Section the parameter lives in. */
  sectionId: string;
  /** Placed right after this parameter id. */
  insertAfterId: string;
  param: AuditParameter;
};

function urgencyCreation(prefix: "call" | "chat"): IntroducedParam {
  return {
    templateId: prefix,
    sectionId: `${prefix}-sales`,
    insertAfterId: `${prefix}-nurturing`,
    param: {
      id: `${prefix}-urgency`,
      name: "Urgency Creation",
      max: 3,
      cat: "Sales & Compliance",
      scoring: "Y/N/NA",
      points: { Y: 3, N: 0 },
    },
  };
}

/** "Urgency Creation" (Yes 3 / No 0) — Sales & Compliance 18 → 21 pts. */
export const INTRODUCED_PARAMS: readonly IntroducedParam[] = [
  urgencyCreation("call"),
  urgencyCreation("chat"),
];

const INTRODUCED_PARAM_IDS = new Set(
  INTRODUCED_PARAMS.map((entry) => entry.param.id)
);

export function isIntroducedParamId(paramId: string): boolean {
  return INTRODUCED_PARAM_IDS.has(paramId);
}

function hasStoredValue(scores: ScoresMap, paramId: string): boolean {
  const value = scores[paramId];
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Editing an audit saved before a parameter was introduced: leave that
 * parameter out (only for this audit) so the audit stays on the rubric it
 * was scored with. Audits that already have a stored value keep it.
 */
export function omitIntroducedParamsForLegacyAudit(
  template: AuditTemplate,
  storedScores: ScoresMap
): AuditTemplate {
  const omit = new Set(
    INTRODUCED_PARAMS.filter(
      (entry) => !hasStoredValue(storedScores, entry.param.id)
    ).map((entry) => entry.param.id)
  );
  if (omit.size === 0) return template;
  if (!template.sections.some((s) => s.params.some((p) => omit.has(p.id)))) {
    return template;
  }

  return {
    ...template,
    sections: template.sections.map((section) =>
      section.params.some((p) => omit.has(p.id))
        ? { ...section, params: section.params.filter((p) => !omit.has(p.id)) }
        : section
    ),
  };
}

/** Never persist an introduced parameter's score when the template omits it. */
export function stripIntroducedScores(
  scores: ScoresMap,
  template: AuditTemplate
): ScoresMap {
  const templateIds = new Set(
    template.sections.flatMap((section) => section.params.map((p) => p.id))
  );
  let changed = false;
  const out: ScoresMap = {};
  for (const [key, value] of Object.entries(scores)) {
    if (INTRODUCED_PARAM_IDS.has(key) && !templateIds.has(key)) {
      changed = true;
      continue;
    }
    out[key] = value;
  }
  return changed ? out : scores;
}
