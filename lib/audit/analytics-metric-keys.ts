import type { AuditRow } from "@/lib/audit/types";

export function metricGroupKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalizes category labels so "$" and "&" variants merge in combined analytics. */
export function canonicalCategoryKey(value: string): string {
  return metricGroupKey(value).replace(/\$/g, "&");
}

export function canonicalCategoryLabel(value: string): string {
  return value.trim().replace(/\$/g, "&");
}

export function parameterGroupKey(row: AuditRow): string {
  const id = row.id?.trim();
  if (id) return `id:${id}`;
  const name = row.name?.trim();
  return name ? `name:${metricGroupKey(name)}` : "";
}

/** Merge equivalent call/chat parameters by normalized parameter name. */
export function crossTemplateParameterGroupKey(row: AuditRow): string {
  const name = row.name?.trim();
  if (name) return `name:${metricGroupKey(name)}`;
  return parameterGroupKey(row);
}

export function resolveParameterGroupKey(
  row: AuditRow,
  mergeAcrossInteractionTypes: boolean
): string {
  return mergeAcrossInteractionTypes
    ? crossTemplateParameterGroupKey(row)
    : parameterGroupKey(row);
}

export function pickDisplayName(
  existing: string | undefined,
  candidate: string
): string {
  const trimmed = candidate.trim();
  if (!trimmed) return existing ?? "";
  if (!existing) return trimmed;
  return existing.length >= trimmed.length ? existing : trimmed;
}
