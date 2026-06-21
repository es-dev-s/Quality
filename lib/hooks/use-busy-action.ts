"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Tracks in-flight async work reliably (unlike startTransition with async callbacks,
 * which can leave UI stuck loading after router.refresh()).
 */
export function useBusyAction() {
  const [busy, setBusy] = useState(false);
  const inFlightRef = useRef(0);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    inFlightRef.current += 1;
    setBusy(true);
    try {
      return await action();
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) {
        setBusy(false);
      }
    }
  }, []);

  return { busy, run };
}
