import type { AuditRow, AuditTemplate } from "@/lib/audit/types";

const CHANNEL_CATEGORY_RE =
  /^(call|chat)\s+(compliance|etiquette|disposition)$/i;

export function metricGroupKey(value: string): string {
  return value.trim().toLowerCase();
}

function titleCaseWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isChatTemplate(template: { id: string; type: string }): boolean {
  return template.id === "chat" || template.type.trim().toLowerCase() === "chat";
}

/** Normalizes category labels so "$"/"&" and Call/Chat prefixes merge. */
export function canonicalCategoryKey(value: string): string {
  const normalized = metricGroupKey(value).replace(/\$/g, "&");
  const match = normalized.match(CHANNEL_CATEGORY_RE);
  return match?.[2] ?? normalized;
}

export function canonicalCategoryLabel(value: string): string {
  return value.trim().replace(/\$/g, "&");
}

/** Chat audits historically stored Call * category names; show Chat * instead. */
export function categoryLabelForInteraction(
  value: string,
  interactionType: string
): string {
  const label = canonicalCategoryLabel(value);
  if (interactionType.trim().toLowerCase() !== "chat") return label;
  const lower = metricGroupKey(label);
  if (lower === "call compliance") return "Chat Compliance";
  if (lower === "call etiquette") return "Chat Etiquette";
  if (lower === "call disposition") return "Chat Disposition";
  return label;
}

/** When Call and Chat variants mix, drop the channel prefix (Compliance, Etiquette, …). */
export function pickCategoryDisplayName(
  existing: string | undefined,
  candidate: string
): string {
  const next = canonicalCategoryLabel(candidate);
  if (!existing?.trim()) return next;
  const prev = canonicalCategoryLabel(existing);

  const prevChannel = prev.match(/^(call|chat)\s+/i)?.[1]?.toLowerCase();
  const nextChannel = next.match(/^(call|chat)\s+/i)?.[1]?.toLowerCase();
  const prevRest = prev.replace(/^(call|chat)\s+/i, "");
  const nextRest = next.replace(/^(call|chat)\s+/i, "");

  if (
    prevChannel &&
    nextChannel &&
    prevChannel !== nextChannel &&
    metricGroupKey(prevRest) === metricGroupKey(nextRest) &&
    /^(compliance|etiquette|disposition)$/i.test(prevRest)
  ) {
    return titleCaseWord(prevRest);
  }

  if (canonicalCategoryKey(prev) === canonicalCategoryKey(next)) {
    if (!prevChannel && nextChannel) return prev;
    if (prevChannel && !nextChannel) return next;
    if (metricGroupKey(prev) === metricGroupKey(next)) {
      return prev.length >= next.length ? prev : next;
    }
  }

  return prev.length >= next.length ? prev : next;
}

export function patchTemplateCategorySpelling(
  template: AuditTemplate
): AuditTemplate {
  const interactionType = isChatTemplate(template) ? "Chat" : template.type;
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      name: categoryLabelForInteraction(section.name, interactionType),
      params: section.params.map((param) => ({
        ...param,
        cat: categoryLabelForInteraction(param.cat, interactionType),
      })),
    })),
  };
}

export function templateHasLegacyCategorySpelling(template: {
  id: string;
  type: string;
  sections: unknown;
}): boolean {
  const json = JSON.stringify(template.sections);
  if (json.includes("Sales $ Compliance")) return true;
  if (!isChatTemplate(template)) return false;
  return (
    json.includes("Call Compliance") ||
    json.includes("Call Etiquette") ||
    json.includes("Call Disposition")
  );
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
