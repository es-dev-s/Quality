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

function hasNestedSubReasons(lob: LOBConfig): boolean {
  return Object.values(lob.sublobReasons ?? {}).some((items) => items.length > 0);
}

/** Sub-reason options for a selected reason (Settings: Reason → Sub-reason). */
export function getSubReasonsForReason(
  lob: LOBConfig | undefined,
  reasonName: string
): string[] {
  if (!lob || !reasonName.trim()) return [];

  const nested = lob.sublobReasons?.[reasonName];
  if (nested?.length) {
    return dedupeSortPreserveCase(nested);
  }

  // Legacy flat list — used until settings migrates to per-reason mapping.
  if (!hasNestedSubReasons(lob) && lob.subReasonsList?.length) {
    return dedupeSortPreserveCase(lob.subReasonsList);
  }

  return [];
}

/** All sub-reasons across reasons (counts, exports). */
export function getLobSubReasonOptions(
  lob: LOBConfig | undefined,
  reasonName?: string
): string[] {
  if (!lob) return [];
  if (reasonName) return getSubReasonsForReason(lob, reasonName);
  if (hasNestedSubReasons(lob)) {
    return dedupeSortPreserveCase(Object.values(lob.sublobReasons ?? {}).flat());
  }
  return dedupeSortPreserveCase(lob.subReasonsList ?? []);
}

/** Flat DFF list (Settings label: DFF). */
export function getLobDffOptions(lob: LOBConfig | undefined): string[] {
  if (!lob) return [];
  if (lob.dffList?.length) {
    return dedupeSortPreserveCase(lob.dffList);
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
  return dedupeSortPreserveCase(Object.values(lob.sublobReasons ?? {}).flat());
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

/** Normalize nested reason → sub-reason map for settings editing. */
export function prepareLobReasonMap(lob: LOBConfig): LOBConfig {
  const sublobs = dedupeSortPreserveCase(lob.sublobs);
  const sublobReasons: Record<string, string[]> = {};

  for (const reason of sublobs) {
    sublobReasons[reason] = dedupeSortPreserveCase(
      lob.sublobReasons?.[reason] ?? []
    );
  }

  if (!hasNestedSubReasons({ ...lob, sublobReasons }) && lob.subReasonsList?.length) {
    const migrated = dedupeSortPreserveCase(lob.subReasonsList);
    if (sublobs.length === 1) {
      sublobReasons[sublobs[0]] = migrated;
    } else if (sublobs.length > 1) {
      for (const reason of sublobs) {
        if (sublobReasons[reason].length === 0) {
          sublobReasons[reason] = [...migrated];
        }
      }
    }
  }

  const dffList =
    lob.dffList?.length ? dedupeSortPreserveCase(lob.dffList) : flattenDffFromNested(lob);

  return {
    ...lob,
    sublobs,
    sublobReasons,
    subReasonsList: flattenSubReasonsFromNested({ ...lob, sublobReasons }),
    dffList,
  };
}

/** Ensures flat DFF list is populated (migrates legacy nested data on read). */
export function ensureLobFlatLists(lob: LOBConfig): LOBConfig {
  const prepared = prepareLobReasonMap(lob);
  const dffList =
    prepared.dffList?.length
      ? dedupeSortPreserveCase(prepared.dffList)
      : flattenDffFromNested(prepared);

  return {
    ...prepared,
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

export function addSubReasonToReason(
  lob: LOBConfig,
  reasonName: string,
  subReason: string
): LOBConfig | null {
  const trimmedReason = reasonName.trim();
  const nextList = addToLobStringList(
    lob.sublobReasons?.[trimmedReason] ?? [],
    subReason
  );
  if (!nextList) return null;

  const sublobReasons = {
    ...(lob.sublobReasons ?? {}),
    [trimmedReason]: nextList,
  };

  return {
    ...lob,
    sublobReasons,
    subReasonsList: flattenSubReasonsFromNested({ ...lob, sublobReasons }),
  };
}

export function removeSubReasonFromReason(
  lob: LOBConfig,
  reasonName: string,
  subReason: string
): LOBConfig {
  const trimmedReason = reasonName.trim();
  const sublobReasons = {
    ...(lob.sublobReasons ?? {}),
    [trimmedReason]: removeFromLobStringList(
      lob.sublobReasons?.[trimmedReason] ?? [],
      subReason
    ),
  };

  return {
    ...lob,
    sublobReasons,
    subReasonsList: flattenSubReasonsFromNested({ ...lob, sublobReasons }),
  };
}
