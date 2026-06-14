import type { AuditRecord, ScoringScheme } from "@/lib/audit/types";

export type ScoreTone =
  | "neutral"
  | "pass"
  | "partial"
  | "fail"
  | "fatal"
  | "na";

export function getScoreTone(
  value: string,
  scoring: ScoringScheme,
  max: number,
  isFatalSection: boolean
): ScoreTone {
  if (isFatalSection) {
    if (value === "Y") return "pass";
    if (value === "N" || value.includes("Non-compliance")) return "fatal";
    return "neutral";
  }

  if (value === "NA" || value === "") return "na";
  if (value === "Fatal") return "fatal";

  if (scoring === "EE/ME/BE/NA") {
    if (value === "EE") return "pass";
    if (value === "ME") return "partial";
    if (value === "BE") return "fail";
    return "na";
  }

  const num = parseFloat(value);
  if (!Number.isNaN(num)) {
    if (num >= max && max > 0) return "pass";
    if (num === 0) return "fail";
    if (num > 0 && num < max) return "partial";
  }

  if (value === "Y") return "pass";
  if (value === "N") return "fail";

  return "neutral";
}

export function toneClass(tone: ScoreTone, prefix: string): string {
  return `${prefix}--${tone}`;
}

export type GradeKey = "excellent" | "good" | "needs" | "failed" | "pending";

export function getGradeKey(record: AuditRecord | null): GradeKey {
  if (!record) return "pending";
  if (record.hasFatal) return "failed";
  if (record.qualityPct >= 90) return "excellent";
  if (record.qualityPct >= 75) return "good";
  return "needs";
}

export function getGradeLabel(record: AuditRecord | null): string {
  if (!record) return "Pending";
  return record.grade;
}
