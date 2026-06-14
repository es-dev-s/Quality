import type { AuditParameter } from "@/lib/audit/types";

/** Resolve earned points for a stored selection value. */
export function resolveParamScore(param: AuditParameter, val: string): number {
  if (val === "NA" || val === "") return 0;

  const pts = param.points;
  if (pts) {
    if (val === "EE" && pts.EE !== undefined) return pts.EE;
    if (val === "ME" && pts.ME !== undefined) return pts.ME;
    if (val === "BE" && pts.BE !== undefined) return pts.BE;
    if (val === "Y" && pts.Y !== undefined) return pts.Y;
    if (val === "N" && pts.N !== undefined) return pts.N;
  }

  const num = parseFloat(val);
  if (!Number.isNaN(num)) return num;

  if (val === "EE") return param.max;
  if (val === "ME") return Math.ceil(param.max / 2);
  if (val === "BE") return 0;
  if (val === "Y") return param.max;
  if (val === "N") return 0;
  return 0;
}

export function isScoringFatal(param: AuditParameter, val: string): boolean {
  if (val === "Fatal") return true;
  if (!param.fatalOn?.length) return false;
  if (param.fatalOn.includes(val as (typeof param.fatalOn)[number])) return true;
  if (val === "0" && param.fatalOn.includes("N")) return true;
  return false;
}
