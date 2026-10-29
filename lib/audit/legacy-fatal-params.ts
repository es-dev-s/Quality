import type {
  AuditParameter,
  AuditRow,
  AuditTemplate,
  ScoresMap,
} from "@/lib/audit/types";
import {
  FORMER_FATAL_YN_PARAM_IDS,
  isNonFatalFormerFatalYnParam,
} from "@/lib/audit/fatal-yn-params";

/**
 * Call Disposition "All Queries Tagged" / "Correct Tagging" used to be
 * Y / FATAL / N/A and are now the standard Y / N / N/A (Yes = 5, No = 0,
 * N/A excluded, never fatal).
 *
 * Audits saved before the change keep their stored rows / totals / quality %
 * / final % (a stored FATAL stays 0% / Failed everywhere). When an audit
 * saved with FATAL on one of these params is edited, that param keeps its
 * legacy Y / FATAL / N/A definition — for that audit only — so re-saving
 * never silently changes its score. Stored "5" / "NA" / non-fatal "0" are
 * already valid on the new definition and score the same.
 */

type StoredRows = readonly Pick<AuditRow, "id" | "fatal">[] | null | undefined;

function storedRowIsFatal(rows: StoredRows, paramId: string): boolean {
  return Boolean(rows?.some((row) => row.id === paramId && row.fatal === true));
}

/** True when an older audit stored FATAL on a former fatal param. */
export function hasLegacyFatalSelection(
  paramId: string,
  storedScores: ScoresMap,
  storedRows?: StoredRows
): boolean {
  if (!FORMER_FATAL_YN_PARAM_IDS.has(paramId)) return false;
  const value = storedScores[paramId]?.trim();
  if (value === "Fatal") return true;
  // Pre-"Fatal" audits stored "0" and scored it as FATAL.
  return value === "0" && storedRowIsFatal(storedRows, paramId);
}

function legacyFatalDefinition(param: AuditParameter): AuditParameter {
  return {
    ...param,
    scoring: "Y/Fatal/NA",
    points: { Y: param.max },
    fatalOptionLabel: "FATAL",
  };
}

/** Restore the legacy FATAL definition for an older audit (that audit only). */
export function restoreLegacyFatalParamsForEdit(
  template: AuditTemplate,
  storedScores: ScoresMap,
  storedRows?: StoredRows
): AuditTemplate {
  let changed = false;
  const sections = template.sections.map((section) => {
    if (section.isFatal) return section;
    let sectionChanged = false;
    const params = section.params.map((param) => {
      if (!isNonFatalFormerFatalYnParam(param)) return param;
      if (!hasLegacyFatalSelection(param.id, storedScores, storedRows)) {
        return param;
      }
      sectionChanged = true;
      return legacyFatalDefinition(param);
    });
    if (!sectionChanged) return section;
    changed = true;
    return { ...section, params };
  });
  return changed ? { ...template, sections } : template;
}

/** True when the param is shown with its legacy FATAL option for this older audit. */
export function isLegacyFatalParamDefinition(param: AuditParameter): boolean {
  return FORMER_FATAL_YN_PARAM_IDS.has(param.id) && param.scoring === "Y/Fatal/NA";
}

/**
 * Former fatal params on the new Y / N / N/A definition have no FATAL
 * option: a "Fatal" value (tampered payload or stale client) is stored as
 * No = 0 instead of failing the audit.
 */
export function normalizeNonFatalFormerFatalScores(
  scores: ScoresMap,
  template: AuditTemplate
): ScoresMap {
  let out: ScoresMap | null = null;
  for (const section of template.sections) {
    for (const param of section.params) {
      if (!isNonFatalFormerFatalYnParam(param)) continue;
      if (scores[param.id] !== "Fatal") continue;
      out ??= { ...scores };
      out[param.id] = String(param.points?.N ?? 0);
    }
  }
  return out ?? scores;
}

/** The `{ id, fatal }` rows of a stored audit record (JSON column), if any. */
export function storedRowsFromRecord(
  record: unknown
): Pick<AuditRow, "id" | "fatal">[] {
  const rows = (record as { rows?: unknown } | null | undefined)?.rows;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row): row is { id: string; fatal?: unknown } =>
        typeof (row as { id?: unknown } | null)?.id === "string"
    )
    .map((row) => ({ id: row.id, fatal: row.fatal === true }));
}
