import type { AuditRow, AuditTemplate, ScoresMap } from "@/lib/audit/types";
import {
  restoreRetiredParamsForEdit,
  stripRetiredScores,
} from "@/lib/audit/retired-params";
import {
  omitIntroducedParamsForLegacyAudit,
  stripIntroducedScores,
} from "@/lib/audit/introduced-params";
import {
  normalizeNonFatalFormerFatalScores,
  restoreLegacyFatalParamsForEdit,
} from "@/lib/audit/legacy-fatal-params";

/**
 * The rubric an existing audit is edited and re-scored with: the current
 * template, plus retired params the audit still has a stored value for
 * (e.g. Call "Hold"), minus params introduced after it was saved
 * (e.g. "Urgency Creation"), with former FATAL params (Call Disposition
 * tagging) kept on the definition the audit was scored with. Keeps the
 * quality % / final % unchanged unless the auditor actually changes a
 * selection.
 */
export function templateForStoredAudit(
  template: AuditTemplate,
  storedScores: ScoresMap,
  storedRows?: readonly Pick<AuditRow, "id" | "fatal">[] | null
): AuditTemplate {
  return restoreLegacyFatalParamsForEdit(
    omitIntroducedParamsForLegacyAudit(
      restoreRetiredParamsForEdit(template, storedScores),
      storedScores
    ),
    storedScores,
    storedRows
  );
}

/**
 * Drop retired / introduced param scores the given template does not score,
 * and never store FATAL on a param that has no FATAL option (Call tagging).
 */
export function sanitizeScoresForTemplate(
  scores: ScoresMap,
  template: AuditTemplate
): ScoresMap {
  return normalizeNonFatalFormerFatalScores(
    stripIntroducedScores(stripRetiredScores(scores, template), template),
    template
  );
}
