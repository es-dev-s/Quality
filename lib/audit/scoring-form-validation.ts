import type { AuditTemplate, ScoresMap } from "@/lib/audit/types";

export type UnratedScoringParam = {
  paramId: string;
  paramName: string;
  sectionId: string;
  sectionName: string;
};

export function findUnratedScoringParams(
  template: AuditTemplate,
  scores: ScoresMap
): UnratedScoringParam[] {
  const missing: UnratedScoringParam[] = [];

  for (const section of template.sections) {
    for (const param of section.params) {
      const raw = scores[param.id];
      if (raw === undefined || raw === "") {
        missing.push({
          paramId: param.id,
          paramName: param.name,
          sectionId: section.id,
          sectionName: section.name,
        });
      }
    }
  }

  return missing;
}

export function validateScoringSectionsComplete(
  template: AuditTemplate,
  scores: ScoresMap
): { ok: true } | { ok: false; paramIds: string[]; sectionIds: string[] } {
  const missing = findUnratedScoringParams(template, scores);
  if (missing.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    paramIds: missing.map((row) => row.paramId),
    sectionIds: [...new Set(missing.map((row) => row.sectionId))],
  };
}
