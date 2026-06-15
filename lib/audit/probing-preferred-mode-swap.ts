import type { AuditParameter, AuditTemplate } from "@/lib/audit/types";

const PROBING_PARAM_IDS = new Set(["call-probing", "chat-probing"]);
const PREFERRED_SWAP_PARAM_IDS = new Set([
  "call-language",
  "chat-preferred-mode",
]);

export function isSwappedProbingParam(paramId: string): boolean {
  return PROBING_PARAM_IDS.has(paramId);
}

export function isSwappedPreferredModeParam(paramId: string): boolean {
  return PREFERRED_SWAP_PARAM_IDS.has(paramId);
}

function patchProbingPreferredModeParam(param: AuditParameter): AuditParameter {
  if (isSwappedProbingParam(param.id)) {
    return {
      ...param,
      scoring: "EE/ME/BE/NA",
      points: { EE: param.max, ME: Math.ceil(param.max / 2), BE: 0 },
    };
  }

  if (isSwappedPreferredModeParam(param.id)) {
    return {
      ...param,
      scoring: "Y/N/NA",
      points: { Y: param.max, N: 0 },
    };
  }

  return param;
}

export function patchTemplateProbingPreferredModeSwap(
  template: AuditTemplate
): AuditTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      params: section.params.map(patchProbingPreferredModeParam),
    })),
  };
}

/** Map legacy stored values after the Probing ↔ Preferred Mode option swap. */
export function normalizeProbingPreferredModeScoreValue(
  paramId: string,
  value: string,
  max: number
): string {
  if (isSwappedProbingParam(paramId)) {
    if (value === "EE" || value === "ME" || value === "BE" || value === "NA") {
      return value;
    }
    if (value === String(max) || value === "Y") return "EE";
    if (value === "0" || value === "N") return "BE";
    return value;
  }

  if (isSwappedPreferredModeParam(paramId)) {
    if (value === String(max) || value === "0" || value === "NA") {
      return value;
    }
    if (value === "EE") return String(max);
    if (value === "ME" || value === "BE") return "0";
    return value;
  }

  return value;
}
