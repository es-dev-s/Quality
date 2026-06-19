"use client";

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
import { usePathname } from "next/navigation";
import { Check, Copy, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type SimpleToast = {
  id: number;
  kind: "simple";
  message: string;
  type: ToastType;
};

type PasswordToast = {
  id: number;
  kind: "password";
  email: string;
  password: string;
  wasReset?: boolean;
  copied?: boolean;
};

type ToastEntry = SimpleToast | PasswordToast;

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
  toastPasswordReveal: (
    email: string,
    password: string,
    options?: { wasReset?: boolean }
  ) => void;
  dismissPasswordToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
};

const PASSWORD_TOAST_MS = 60_000;
const PASSWORD_TOAST_MAX = 3;

function PasswordToastItem({
  entry,
  onDismiss,
  onCopy,
}: {
  entry: PasswordToast;
  onDismiss: (id: number) => void;
  onCopy: (id: number, password: string) => void;
}) {
  return (
    <div className="toast-item toast-item--password" role="status">
      <div className="toast-password__head">
        <span className="toast-password__email" title={entry.email}>
          {entry.email}
        </span>
        <button
          type="button"
          className="toast-password__icon-btn"
          onClick={() => onDismiss(entry.id)}
          aria-label="Close"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="toast-password__row">
        <code className="toast-password__value" title={entry.password}>
          {entry.password}
        </code>
        <button
          type="button"
          className="toast-password__copy"
          onClick={() => onCopy(entry.id, entry.password)}
          aria-label={entry.copied ? "Copied" : "Copy password"}
        >
          {entry.copied ? (
            <>
              <Check size={12} aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} aria-hidden />
              Copy
            </>
          )}
        </button>
      </div>
      {entry.wasReset ? (
        <p className="toast-password__note">New temporary password set</p>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timeoutsRef = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const dismissPasswordToasts = useCallback(() => {
    setToasts((prev) => {
      for (const entry of prev) {
        if (entry.kind !== "password") continue;
        const timeout = timeoutsRef.current.get(entry.id);
        if (timeout) {
          window.clearTimeout(timeout);
          timeoutsRef.current.delete(entry.id);
        }
      }
      return prev.filter((t) => t.kind !== "password");
    });
  }, []);

  useEffect(() => {
    dismissPasswordToasts();
  }, [pathname, dismissPasswordToasts]);

  const scheduleDismiss = useCallback(
    (id: number, duration: number) => {
      const timeout = window.setTimeout(() => dismiss(id), duration);
      timeoutsRef.current.set(id, timeout);
    },
    [dismiss]
  );

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, kind: "simple", message, type }]);
      scheduleDismiss(id, DISMISS_MS[type]);
    },
    [scheduleDismiss]
  );

  const toastPasswordReveal = useCallback(
    (
      email: string,
      password: string,
      options?: { wasReset?: boolean }
    ) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const next: PasswordToast = {
        id,
        kind: "password",
        email,
        password,
        wasReset: options?.wasReset,
      };

      setToasts((prev) => {
        const passwordToasts = prev.filter((t) => t.kind === "password");
        const others = prev.filter((t) => t.kind !== "password");
        const excess = passwordToasts.length - PASSWORD_TOAST_MAX + 1;
        let keptPasswords = passwordToasts;

        if (excess > 0) {
          const removed = passwordToasts.slice(0, excess);
          for (const item of removed) {
            const timeout = timeoutsRef.current.get(item.id);
            if (timeout) {
              window.clearTimeout(timeout);
              timeoutsRef.current.delete(item.id);
            }
          }
          keptPasswords = passwordToasts.slice(excess);
        }

        return [...others, ...keptPasswords, next];
      });

      scheduleDismiss(id, PASSWORD_TOAST_MS);
    },
    [scheduleDismiss]
  );

  const copyPassword = useCallback(async (id: number, password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id && t.kind === "password" ? { ...t, copied: true } : t
        )
      );
      window.setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) =>
            t.id === id && t.kind === "password" ? { ...t, copied: false } : t
          )
        );
      }, 2000);
    } catch {
      toast("Could not copy to clipboard.", "error");
    }
  }, [toast]);

  const value = useMemo(
    () => ({ toast, toastPasswordReveal, dismissPasswordToasts }),
    [toast, toastPasswordReveal, dismissPasswordToasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-stack">
        {toasts.map((t) =>
          t.kind === "password" ? (
            <PasswordToastItem
              key={t.id}
              entry={t}
              onDismiss={dismiss}
              onCopy={copyPassword}
            />
          ) : (
            <div
              key={t.id}
              className={`toast-item toast-item--${t.type}`}
              role="status"
            >
              {t.message}
            </div>
          )
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
