"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleIds]);

  const selectedCount = useMemo(() => {
    let count = 0;
    for (const id of visibleIds) {
      if (selectedIds.has(id)) count += 1;
    }
    return count;
  }, [selectedIds, visibleIds]);

  const allVisibleSelected =
    visibleIds.length > 0 && selectedCount === visibleIds.length;
  const someVisibleSelected =
    selectedCount > 0 && selectedCount < visibleIds.length;

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

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  return {
    selectedIds,
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
