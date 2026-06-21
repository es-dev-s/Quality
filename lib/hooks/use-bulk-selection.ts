"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Tracks row selection for bulk actions.
 * @param items Full selectable pool (e.g. all filtered rows).
 * @param visibleItems Current page / visible slice for header checkbox state.
 */
export function useBulkSelection<T extends { id: string }>(
  items: T[],
  visibleItems?: T[]
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const poolIds = useMemo(() => items.map((item) => item.id), [items]);
  const visible = visibleItems ?? items;
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const pool = new Set(poolIds);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (pool.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [poolIds]);

  const selectedCount = selectedIds.size;

  const visibleSelectedCount = useMemo(() => {
    let count = 0;
    for (const id of visibleIds) {
      if (selectedIds.has(id)) count += 1;
    }
    return count;
  }, [selectedIds, visibleIds]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const everySelected = visibleIds.every((id) => next.has(id));
      if (everySelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectedIdList,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    isSelected,
    selectedItems,
  };
}
