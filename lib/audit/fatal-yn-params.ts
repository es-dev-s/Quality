import type { AuditParameter, AuditTemplate } from "@/lib/audit/types";

/** Params where the former "N — 0" option is shown and scored as FATAL. */
export const FATAL_YN_PARAM_IDS = new Set([
  "call-correct",
  "call-complete",
  "chat-correct",
  "chat-complete",
  "chat-alltagged",
  "chat-correcttag",
]);

/**
 * Call Disposition params that used to be Y / FATAL / N/A and are now the
 * standard Y / N / N/A (Yes = max, No = 0, N/A excluded, never fatal). Audits saved while they were
 * fatal keep that legacy definition for that audit only — see
 * `lib/audit/legacy-fatal-params.ts`.
 */
export const FORMER_FATAL_YN_PARAM_IDS = new Set([
  "call-alltagged",
  "call-correcttag",
]);

type ParamLike = Pick<AuditParameter, "id" | "scoring">;

function paramIdOf(param: string | ParamLike): string {
  return typeof param === "string" ? param : param.id;
}

/**
 * True when the param scores a legacy "0" as FATAL. Former fatal params only
 * count while they still use the legacy Y/Fatal/NA definition (older audits).
 */
export function isFatalYnParam(param: string | ParamLike): boolean {
  const id = paramIdOf(param);
  if (FATAL_YN_PARAM_IDS.has(id)) return true;
  return (
    typeof param !== "string" &&
    FORMER_FATAL_YN_PARAM_IDS.has(id) &&
    param.scoring === "Y/Fatal/NA"
  );
}

export function isFormerFatalYnParamId(paramId: string): boolean {
  return FORMER_FATAL_YN_PARAM_IDS.has(paramId);
}

/** A former fatal param on its new Y / N / N/A definition (no FATAL option). */
export function isNonFatalFormerFatalYnParam(param: ParamLike): boolean {
  return FORMER_FATAL_YN_PARAM_IDS.has(param.id) && param.scoring === "Y/N/NA";
}

export function patchFatalYnParam(param: AuditParameter): AuditParameter {
  if (!FATAL_YN_PARAM_IDS.has(param.id)) return param;

  return {
    ...param,
    scoring: "Y/Fatal/NA",
    points: { Y: param.max },
    fatalOptionLabel: "FATAL",
  };
}

function isFatalCapableDefinition(param: AuditParameter): boolean {
  return (
    param.scoring === "Y/Fatal/NA" ||
    param.scoring === "Y/N/Fatal/NA" ||
    Boolean(param.fatalOptionLabel) ||
    Boolean(param.fatalOn?.length)
  );
}

/** Former fatal params: fatal definitions become Y / N / N/A (Y = max, N = 0). */
export function patchFormerFatalYnParam(param: AuditParameter): AuditParameter {
  if (!FORMER_FATAL_YN_PARAM_IDS.has(param.id)) return param;
  if (!isFatalCapableDefinition(param)) return param;

  const patched: AuditParameter = {
    ...param,
    scoring: "Y/N/NA",
    points: { Y: param.max, N: 0 },
  };
  delete patched.fatalOptionLabel;
  delete patched.fatalOn;
  return patched;
}

export function patchTemplateFatalYnParams(
  template: AuditTemplate
): AuditTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      params: section.params.map((param) =>
        patchFormerFatalYnParam(patchFatalYnParam(param))
      ),
    })),
  };
}

/** True when stored template sections still define a former fatal param as fatal. */
export function templateSectionsHaveFormerFatalYnParams(sections: unknown): boolean {
  if (!Array.isArray(sections)) return false;
  return sections.some(
    (section) =>
      Array.isArray((section as { params?: unknown })?.params) &&
      (section as { params: AuditParameter[] }).params.some(
        (param) =>
          typeof param?.id === "string" &&
          FORMER_FATAL_YN_PARAM_IDS.has(param.id) &&
          isFatalCapableDefinition(param)
      )
  );
}

/** Map legacy stored "0" selections to Fatal for patched params. */
export function normalizeFatalYnScoreValue(
  param: string | ParamLike,
  value: string
): string {
  if (isFatalYnParam(param) && value === "0") return "Fatal";
  return value;
}
