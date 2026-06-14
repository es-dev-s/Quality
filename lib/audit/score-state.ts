import type {
  AuditParameter,
  AuditSection,
  AuditTemplate,
  ScoresMap,
} from "@/lib/audit/types";

export function isScoreAffectingParam(param: AuditParameter): boolean {
  return param.scoring !== "Y/N-CMM";
}

export function isScoreAffectingSection(section: AuditSection): boolean {
  return section.params.some(isScoreAffectingParam);
}

/** Fatal section params default to Y (compliance) when unrated. */
export function buildDefaultScores(template: AuditTemplate): ScoresMap {
  const scores: ScoresMap = {};
  for (const sec of template.sections) {
    if (!sec.isFatal) continue;
    for (const param of sec.params) {
      scores[param.id] = "Y";
    }
  }
  return scores;
}

export function getEffectiveScore(
  scores: ScoresMap,
  paramId: string,
  isFatal: boolean
): string {
  const raw = scores[paramId];
  if (raw !== undefined && raw !== "") {
    return raw;
  }
  return isFatal ? "Y" : "NA";
}
