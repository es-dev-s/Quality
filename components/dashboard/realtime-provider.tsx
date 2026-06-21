"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuditSSEEvent, type SSEEvent } from "@/lib/sse-events";

type RealtimeListener = (event: SSEEvent) => void;
type Unsubscribe = () => void;

const RealtimeContext = createContext<
  ((listener: RealtimeListener) => Unsubscribe) | null
>(null);

const AUDIT_LOGS_PATH = "/audit-logs";
const DATA_REFRESH_DEBOUNCE_MS = 500;

function isDataPage(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/reports")
  );
}

function isRosterPage(pathname: string): boolean {
  return pathname.startsWith("/settings") || pathname.startsWith("/forms");
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<RealtimeListener>());
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const subscribe = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const scheduleDataRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, DATA_REFRESH_DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;
    let eventSource: EventSource | null = null;

    function connect() {
      if (eventSource?.readyState === EventSource.OPEN) return;

      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        reconnectDelay = 1000;
      };

      eventSource.onmessage = (message) => {
        if (message.data.startsWith(":")) return;

        try {
          const event = JSON.parse(message.data) as SSEEvent;
          if (event.type === "connected") return;

          for (const listener of listenersRef.current) {
            listener(event);
          }

          if (isAuditSSEEvent(event)) {
            const currentPath = pathnameRef.current;
            if (isDataPage(currentPath)) {
              scheduleDataRefresh();
            } else if (
              currentPath.startsWith(AUDIT_LOGS_PATH) &&
              event.type === "audit:created"
            ) {
              scheduleDataRefresh();
            }
          }

          if (
            (event.type === "user:activated" ||
              event.type === "user:deactivated") &&
            isRosterPage(pathnameRef.current)
          ) {
            scheduleDataRefresh();
          }
        } catch {
          // ignore malformed payloads
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        const delay = Math.min(reconnectDelay, 30_000);
        reconnectDelay = Math.min(delay * 2, 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleDataRefresh]);

  return (
    <RealtimeContext.Provider value={subscribe}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(onEvent: RealtimeListener) {
  const subscribe = useContext(RealtimeContext);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!subscribe) return;
    return subscribe((event) => handlerRef.current(event));
  }, [subscribe]);
}
