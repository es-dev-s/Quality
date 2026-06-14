import type { LOBConfig } from "@/lib/audit/types";

function dedupeSortPreserveCase(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

/** Flat sub-reason list (Settings label: Sub-reason). */
export function getLobSubReasonOptions(lob: LOBConfig | undefined): string[] {
  if (!lob) return [];
  if (lob.subReasonsList?.length) {
    return [...lob.subReasonsList];
  }
  return dedupeSortPreserveCase(
    Object.values(lob.sublobReasons ?? {}).flat()
  );
}

/** Flat DFF list (Settings label: DFF). */
export function getLobDffOptions(lob: LOBConfig | undefined): string[] {
  if (!lob) return [];
  if (lob.dffList?.length) {
    return [...lob.dffList];
  }
  const nested: string[] = [];
  for (const reasonMap of Object.values(lob.sublobReasonSubReasons ?? {})) {
    for (const items of Object.values(reasonMap)) {
      nested.push(...items);
    }
  }
  for (const items of Object.values(lob.reasonSubReasons ?? {})) {
    nested.push(...items);
  }
  return dedupeSortPreserveCase(nested);
}

function flattenSubReasonsFromNested(lob: LOBConfig): string[] {
  return dedupeSortPreserveCase(
    Object.values(lob.sublobReasons ?? {}).flat()
  );
}

function flattenDffFromNested(lob: LOBConfig): string[] {
  const nested: string[] = [];
  for (const reasonMap of Object.values(lob.sublobReasonSubReasons ?? {})) {
    for (const items of Object.values(reasonMap)) {
      nested.push(...items);
    }
  }
  for (const items of Object.values(lob.reasonSubReasons ?? {})) {
    nested.push(...items);
  }
  return dedupeSortPreserveCase(nested);
}

/** Ensures flat lists are populated (migrates legacy nested data on read). */
export function ensureLobFlatLists(lob: LOBConfig): LOBConfig {
  const subReasonsList =
    lob.subReasonsList?.length
      ? dedupeSortPreserveCase(lob.subReasonsList)
      : flattenSubReasonsFromNested(lob);
  const dffList =
    lob.dffList?.length ? dedupeSortPreserveCase(lob.dffList) : flattenDffFromNested(lob);

  return {
    ...lob,
    subReasonsList,
    dffList,
  };
}

export function addToLobStringList(
  list: string[],
  value: string
): string[] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return null;
  }
  return dedupeSortPreserveCase([...list, trimmed]);
}

export function removeFromLobStringList(list: string[], value: string): string[] {
  return list.filter((item) => item !== value);
}
