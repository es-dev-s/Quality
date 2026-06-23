export type AnalyticsSortOrder = "asc" | "desc";

export function sortByNumber<T>(
  items: readonly T[],
  getValue: (item: T) => number,
  order: AnalyticsSortOrder
): T[] {
  const sorted = [...items].sort((a, b) => getValue(a) - getValue(b));
  return order === "desc" ? sorted.reverse() : sorted;
}

export function sortByString<T>(
  items: readonly T[],
  getValue: (item: T) => string,
  order: AnalyticsSortOrder
): T[] {
  const sorted = [...items].sort((a, b) =>
    getValue(a).localeCompare(getValue(b), undefined, { sensitivity: "base" })
  );
  return order === "desc" ? sorted.reverse() : sorted;
}

export function sortBreakdownRows<
  T extends { entity: string; metric: string; score: number },
>(rows: readonly T[], order: AnalyticsSortOrder): T[] {
  const sorted = [...rows].sort((a, b) => {
    const entityCmp = a.entity.localeCompare(b.entity, undefined, {
      sensitivity: "base",
    });
    if (entityCmp !== 0) return entityCmp;
    return a.score - b.score;
  });
  if (order === "desc") {
    return sorted.reverse();
  }
  return sorted;
}
