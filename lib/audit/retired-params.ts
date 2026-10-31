import type { AuditParameter, AuditTemplate, ScoresMap } from "@/lib/audit/types";

/**
 * Parameters that were removed from a rubric. New audits never see them;
 * audits saved before the removal keep their stored values (scores, rows,
 * catScores, totals) untouched, and editing such an audit keeps the
 * retired parameter scored from its stored value so the quality % does not
 * silently change.
 */
type RetiredParam = {
  /** Section the parameter used to live in. */
  sectionId: string;
  /** Re-insert after this parameter id when restoring for an old audit. */
  insertAfterId: string | null;
  param: AuditParameter;
};

const RETIRED_PARAMS: RetiredParam[] = [
  {
    // "Hold (<=1min 3x)" — removed from Call Compliance (Call 100 → 97 pts).
    sectionId: "call-compliance",
    insertAfterId: "call-closing",
    param: {
      id: "call-hold",
      name: "Hold (<=1min 3x)",
      max: 3,
      cat: "Call Compliance",
      scoring: "Y/N/NA",
      points: { Y: 3, N: 0 },
    },
  },
];

const RETIRED_PARAM_IDS = new Set(RETIRED_PARAMS.map((entry) => entry.param.id));

export function isRetiredParamId(paramId: string): boolean {
  return RETIRED_PARAM_IDS.has(paramId);
}

/** True when stored template sections still contain a retired parameter. */
export function templateSectionsHaveRetiredParams(sections: unknown): boolean {
  if (!Array.isArray(sections)) return false;
  return sections.some(
    (section) =>
      Array.isArray((section as { params?: unknown })?.params) &&
      ((section as { params: Array<{ id?: unknown }> }).params).some(
        (param) => typeof param?.id === "string" && RETIRED_PARAM_IDS.has(param.id)
      )
  );
}

/** Drop retired parameters from a template (what new audits are scored on). */
export function removeRetiredTemplateParams(template: AuditTemplate): AuditTemplate {
  if (!templateSectionsHaveRetiredParams(template.sections)) return template;
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      params: section.params.filter((param) => !RETIRED_PARAM_IDS.has(param.id)),
    })),
  };
}

function hasStoredValue(scores: ScoresMap, paramId: string): boolean {
  const value = scores[paramId];
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Editing an audit saved before a parameter was retired: put the retired
 * parameter back (only for that audit) so it keeps being scored from its
 * stored value. Audits without a stored value are returned unchanged.
 */
export function restoreRetiredParamsForEdit(
  template: AuditTemplate,
  storedScores: ScoresMap
): AuditTemplate {
  let sections = template.sections;

  for (const retired of RETIRED_PARAMS) {
    if (!hasStoredValue(storedScores, retired.param.id)) continue;
    if (sections.some((s) => s.params.some((p) => p.id === retired.param.id))) {
      continue;
    }

    const sectionIndex = sections.findIndex(
      (section) => section.id === retired.sectionId && !section.isFatal
    );
    if (sectionIndex === -1) continue;

    sections = sections.map((section, index) => {
      if (index !== sectionIndex) return section;
      const params = [...section.params];
      const afterIndex = retired.insertAfterId
        ? params.findIndex((p) => p.id === retired.insertAfterId)
        : -1;
      const param = { ...retired.param, cat: section.name };
      if (afterIndex === -1) params.push(param);
      else params.splice(afterIndex + 1, 0, param);
      return { ...section, params };
    });
  }

  return sections === template.sections ? template : { ...template, sections };
}

/** Never persist a retired parameter's score unless the template scores it. */
export function stripRetiredScores(
  scores: ScoresMap,
  template: AuditTemplate
): ScoresMap {
  const templateIds = new Set(
    template.sections.flatMap((section) => section.params.map((p) => p.id))
  );
  let changed = false;
  const out: ScoresMap = {};
  for (const [key, value] of Object.entries(scores)) {
    if (RETIRED_PARAM_IDS.has(key) && !templateIds.has(key)) {
      changed = true;
      continue;
    }
    out[key] = value;
  }
  return changed ? out : scores;
}
