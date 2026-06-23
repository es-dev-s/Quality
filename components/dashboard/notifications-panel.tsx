"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { useToast } from "@/components/primitives/toast";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/notifications/types";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { isNotificationSSEEvent } from "@/lib/sse-events";
import { cn } from "@/lib/utils";

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

function mergeNotification(
  items: NotificationItem[],
  incoming: NotificationItem
): NotificationItem[] {
  const withoutDup = items.filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutDup].slice(0, 30);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getNotifications({ limit: 20 });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // keep last known state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime(
    useCallback(
      (event) => {
        if (!isNotificationSSEEvent(event)) return;

        const incoming = event.notification;
        setItems((current) => mergeNotification(current, incoming));
        setUnreadCount((count) => count + 1);
        toast(incoming.title, "warning");
      },
      [toast]
    )
  );

  const markRead = useCallback(async (id: string) => {
    const result = await markNotificationRead(id);
    if ("error" in result && result.error) return;

    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, readAt: new Date().toISOString() }
          : item
      )
    );
    setUnreadCount(result.unreadCount);
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? now }))
    );
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, unreadCount, loading, refresh, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const { items, unreadCount, loading, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="notification-bell" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        className="notification-bell__trigger"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} aria-hidden />
        {unreadCount > 0 ? (
          <span className="notification-bell__badge" aria-hidden>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="notification-bell__panel" role="menu">
          <div className="notification-bell__head">
            <p className="notification-bell__title">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="notification-bell__mark-all"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="notification-bell__list">
            {loading && items.length === 0 ? (
              <p className="notification-bell__empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notification-bell__empty">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "notification-bell__item",
                    !item.readAt && "notification-bell__item--unread"
                  )}
                  role="menuitem"
                  onClick={() => {
                    if (!item.readAt) {
                      void markRead(item.id);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="notification-bell__item-title">
                    {item.title}
                  </span>
                  <span className="notification-bell__item-body">{item.body}</span>
                  <span className="notification-bell__item-time">
                    {formatWhen(item.createdAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
