"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/sse-events";

type RealtimeHandler = (event: SSEEvent) => void;

export function useRealtime(onEvent: RealtimeHandler) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onopen = () => {
      reconnectDelayRef.current = 1000;
    };

    es.onmessage = (e) => {
      if (e.data.startsWith(":")) return;
      try {
        const event = JSON.parse(e.data) as SSEEvent;
        if (event.type === "connected") return;
        handlerRef.current(event);
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      const delay = Math.min(reconnectDelayRef.current, 30_000);
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
}
