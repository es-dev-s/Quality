"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Controlled filter sidebar state. Single source of truth avoids open/close races
 * from competing toggles, backdrop clicks, and Escape.
 */
export function useFilterSidebar(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const openRef = useRef(open);
  openRef.current = open;

  const onOpenChange = useCallback((next: boolean) => {
    setOpen((current) => (current === next ? current : next));
  }, []);

  const openFilters = useCallback(() => {
    if (!openRef.current) setOpen(true);
  }, []);

  const closeFilters = useCallback(() => {
    if (openRef.current) setOpen(false);
  }, []);

  const toggleFilters = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  return {
    open,
    onOpenChange,
    openFilters,
    closeFilters,
    toggleFilters,
  };
}
