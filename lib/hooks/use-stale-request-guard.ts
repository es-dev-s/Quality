"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Ignores stale async responses when params change or the component unmounts.
 */
export function useStaleRequestGuard() {
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const beginRequest = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    return {
      isStale: () =>
        !mountedRef.current || requestIdRef.current !== requestId,
    };
  }, []);

  return { beginRequest };
}
