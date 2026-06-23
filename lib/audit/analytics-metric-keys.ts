import type { AuditRow } from "@/lib/audit/types";

export function metricGroupKey(value: string): string {
  return value.trim().toLowerCase();
}

export function parameterGroupKey(row: AuditRow): string {
  const id = row.id?.trim();
  if (id) return `id:${id}`;
  const name = row.name?.trim();
  return name ? `name:${metricGroupKey(name)}` : "";
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
