import type {
  AuditFormData,
  AuditRecord,
  AuditRow,
  AuditTemplate,
  CategoryScore,
  ScoresMap,
} from "@/lib/audit/types";
import { isScoringFatal, resolveParamScore } from "@/lib/audit/resolve-score";

function randomAuditSuffix(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function computeGrades(qualityPct: number, hasFatal: boolean) {
  const grade = hasFatal
    ? "Failed"
    : qualityPct >= 90
      ? "Excellent"
      : qualityPct >= 75
        ? "Good"
        : "Needs Improvement";

  const gc = hasFatal ? "red" : qualityPct >= 75 ? "green" : "amber";

  const qualityGrade =
    qualityPct >= 90
      ? "Excellent"
      : qualityPct >= 75
        ? "Good"
        : "Needs Improvement";

  const qualityGc = qualityPct >= 75 ? "green" : "amber";

  return { grade, gc, qualityGrade, qualityGc };
}

export type CalculateResult =
  | { ok: true; record: AuditRecord }
  | { ok: false; error: string };

export function calculateResults(
  formData: AuditFormData,
  scores: ScoresMap,
  template: AuditTemplate,
  initialData?: Partial<AuditRecord>
): CalculateResult {
  if (!template) {
    return { ok: false, error: "No audit template loaded." };
  }

  let totalScored = 0;
  let totalMax = 0;
  let hasFatal = false;
  const fatalList: string[] = [];
  const catScores: Record<string, CategoryScore> = {};
  const rows: AuditRow[] = [];

  for (const sec of template.sections) {
    for (const param of sec.params) {
      if (param.scoring === "Y/N-CMM") continue;

      const raw = scores[param.id];
      const val =
        raw !== undefined && raw !== ""
          ? raw
          : sec.isFatal
            ? "Y"
            : "NA";

      if (sec.isFatal) {
        if (val === "N" || val.includes("Non-compliance")) {
          hasFatal = true;
          fatalList.push(param.name);
        }
        continue;
      }

      if (val === "NA") continue;

      if (val === "Fatal" || isScoringFatal(param, val)) {
        hasFatal = true;
        fatalList.push(param.name);
        totalMax += param.max;

        if (!catScores[sec.name]) {
          catScores[sec.name] = { scored: 0, max: 0 };
        }
        catScores[sec.name].max += param.max;

        rows.push({
          id: param.id,
          cat: sec.name,
          name: param.name,
          max: param.max,
          sel: val === "Fatal" ? "Fatal" : val,
          score: 0,
          fatal: true,
          isScoringFatal: true,
        });
        continue;
      }

      const sc = resolveParamScore(param, val);
      totalScored += sc;
      totalMax += param.max;

      if (!catScores[sec.name]) {
        catScores[sec.name] = { scored: 0, max: 0 };
      }
      catScores[sec.name].scored += sc;
      catScores[sec.name].max += param.max;

      rows.push({
        id: param.id,
        cat: sec.name,
        name: param.name,
        max: param.max,
        sel: val,
        score: sc,
        fatal: false,
      });
    }
  }

  const qualityPct =
    totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
  const finalPct = hasFatal ? 0 : qualityPct;
  const grades = computeGrades(qualityPct, hasFatal);

  const id =
    initialData?.id ??
    `AUD-${Date.now()}-${randomAuditSuffix()}`;

  const record: AuditRecord = {
    ...formData,
    id,
    savedAt: new Date().toLocaleDateString(),
    qualityPct,
    finalPct,
    ...grades,
    hasFatal,
    fatalList,
    feedbackSecurity: formData.feedbackSecurity ?? initialData?.feedbackSecurity ?? "NA",
    feedbackStatus: formData.feedbackStatus ?? initialData?.feedbackStatus ?? "Pending",
    feedbackDate: formData.feedbackDate ?? initialData?.feedbackDate ?? "",
    agentFeedback: formData.agentFeedback ?? initialData?.agentFeedback ?? "",
    totalScored,
    totalMax,
    catScores,
    rows,
  };

  return { ok: true, record };
}
