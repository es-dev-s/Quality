import type { LOBConfig } from "@/lib/audit/types";
import {
  getLobDffOptions,
  getLobSubReasonOptions,
  getSubReasonsForReason,
} from "@/lib/audit/lob-flat-lists";

export function getReasonOptions(
  lob: LOBConfig | undefined,
  sublob: string
): string[] {
  return getSubReasonsForReason(lob, sublob);
}

/** @deprecated Use getLobDffOptions for flat lists. Kept for legacy callers. */
export function getSubReasonOptions(
  lob: LOBConfig | undefined,
  _sublob: string,
  _reason: string
): string[] {
  return getLobDffOptions(lob);
}

export {
  getLobDffOptions,
  getLobSubReasonOptions,
  getSubReasonsForReason,
} from "@/lib/audit/lob-flat-lists";
