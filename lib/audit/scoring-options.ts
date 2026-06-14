import type { AuditParameter, ScoringScheme } from "@/lib/audit/types";

export type ScoreOption = {
  label: string;
  value: string;
};

export function getScoringOptions(
  scoring: ScoringScheme,
  max: number,
  param?: Pick<AuditParameter, "points" | "fatalOptionLabel">
): ScoreOption[] {
  const pts = param?.points;
  const fatalLabel = param?.fatalOptionLabel ?? "FATAL-0";

  switch (scoring) {
    case "Y/Fatal/NA":
      return [
        {
          label: `Y — ${pts?.Y ?? max}`,
          value: String(pts?.Y ?? max),
        },
        { label: fatalLabel, value: "Fatal" },
        { label: "N/A", value: "NA" },
      ];
    case "Y/N/Fatal/NA":
      return [
        {
          label: `Y — ${pts?.Y ?? max}`,
          value: String(pts?.Y ?? max),
        },
        { label: "N — 0", value: "0" },
        { label: "Fatal", value: "Fatal" },
        { label: "N/A", value: "NA" },
      ];
    case "Y/N/NA":
      return [
        {
          label: `Y — ${pts?.Y ?? max}`,
          value: String(pts?.Y ?? max),
        },
        { label: "N — 0", value: "0" },
        { label: "N/A", value: "NA" },
      ];
    case "EE/ME/BE/NA":
      return [
        {
          label: `EE — ${pts?.EE ?? max}`,
          value: "EE",
        },
        {
          label: `ME — ${pts?.ME ?? Math.ceil(max / 2)}`,
          value: "ME",
        },
        { label: "BE — 0", value: "BE" },
        { label: "N/A", value: "NA" },
      ];
    case "Y/N-CMM":
      return [
        { label: "Y — Compliance", value: "Y" },
        { label: "N — Non-compliance", value: "N" },
      ];
    default:
      return [];
  }
}
