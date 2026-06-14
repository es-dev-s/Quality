import type { LOBConfig } from "@/lib/audit/types";
import {
  getLobDffOptions,
  getLobSubReasonOptions,
} from "@/lib/audit/lob-flat-lists";

/** @deprecated Use getLobSubReasonOptions for flat lists. Kept for legacy callers. */
export function getReasonOptions(
  lob: LOBConfig | undefined,
  _sublob: string
): string[] {
  return getLobSubReasonOptions(lob);
}

/** @deprecated Use getLobDffOptions for flat lists. Kept for legacy callers. */
export function getSubReasonOptions(
  lob: LOBConfig | undefined,
  _sublob: string,
  _reason: string
): string[] {
  return getLobDffOptions(lob);
}

export { getLobDffOptions, getLobSubReasonOptions } from "@/lib/audit/lob-flat-lists";
