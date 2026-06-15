import type { AuditParameter, AuditTemplate } from "@/lib/audit/types";

/** Params where the former "N — 0" option is shown and scored as FATAL. */
export const FATAL_YN_PARAM_IDS = new Set([
  "call-correct",
  "call-complete",
  "call-alltagged",
  "call-correcttag",
  "chat-correct",
  "chat-complete",
  "chat-alltagged",
  "chat-correcttag",
]);

export function isFatalYnParam(paramId: string): boolean {
  return FATAL_YN_PARAM_IDS.has(paramId);
}

export function patchFatalYnParam(param: AuditParameter): AuditParameter {
  if (!isFatalYnParam(param.id)) return param;

  return {
    ...param,
    scoring: "Y/Fatal/NA",
    points: { Y: param.max },
    fatalOptionLabel: "FATAL",
  };
}

export function patchTemplateFatalYnParams(
  template: AuditTemplate
): AuditTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      params: section.params.map(patchFatalYnParam),
    })),
  };
}

/** Map legacy stored "0" selections to Fatal for patched params. */
export function normalizeFatalYnScoreValue(
  paramId: string,
  value: string
): string {
  if (isFatalYnParam(paramId) && value === "0") return "Fatal";
  return value;
}
