import type {
  AuditParameter,
  AuditSection,
  AuditTemplate,
  ScoringScheme,
  ScoresMap,
} from "@/lib/audit/types";

export function isScoreAffectingParam(param: AuditParameter): boolean {
  return param.scoring !== "Y/N-CMM";
}

export function isScoreAffectingSection(section: AuditSection): boolean {
  return section.params.some(isScoreAffectingParam);
}

/** Fatal and CMM params default to Y (compliance) when unrated. */
export function buildDefaultScores(template: AuditTemplate): ScoresMap {
  const scores: ScoresMap = {};
  for (const sec of template.sections) {
    for (const param of sec.params) {
      if (sec.isFatal || param.scoring === "Y/N-CMM") {
        scores[param.id] = "Y";
      }
    }
  }
  return scores;
}

export function mergeTemplateDefaultScores(
  template: AuditTemplate,
  scores: ScoresMap
): ScoresMap {
  return { ...buildDefaultScores(template), ...scores };
}

export function getEffectiveScore(
  scores: ScoresMap,
  paramId: string,
  isFatal: boolean,
  scoring?: ScoringScheme
): string {
  const raw = scores[paramId];
  if (raw !== undefined && raw !== "") {
    return raw;
  }
  if (isFatal || scoring === "Y/N-CMM") {
    return "Y";
  }
  return "NA";
}
