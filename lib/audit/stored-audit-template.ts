import type { AuditTemplate, ScoresMap } from "@/lib/audit/types";
import {
  restoreRetiredParamsForEdit,
  stripRetiredScores,
} from "@/lib/audit/retired-params";
import {
  omitIntroducedParamsForLegacyAudit,
  stripIntroducedScores,
} from "@/lib/audit/introduced-params";

/**
 * The rubric an existing audit is edited and re-scored with: the current
 * template, plus retired params the audit still has a stored value for
 * (e.g. Call "Hold"), minus params introduced after it was saved
 * (e.g. "Urgency Creation"). Keeps the quality % unchanged unless the
 * auditor actually changes a selection.
 */
export function templateForStoredAudit(
  template: AuditTemplate,
  storedScores: ScoresMap
): AuditTemplate {
  return omitIntroducedParamsForLegacyAudit(
    restoreRetiredParamsForEdit(template, storedScores),
    storedScores
  );
}

/** Drop retired / introduced param scores the given template does not score. */
export function sanitizeScoresForTemplate(
  scores: ScoresMap,
  template: AuditTemplate
): ScoresMap {
  return stripIntroducedScores(stripRetiredScores(scores, template), template);
}
