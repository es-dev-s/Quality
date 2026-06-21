"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RealtimeProvider } from "@/components/dashboard/realtime-provider";
import type { SessionRole } from "@/lib/rbac";

export type DashboardUser = {
  name?: string | null;
  email?: string | null;
  role: SessionRole;
};

type ShellContextValue = {
  user: DashboardUser;
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useDashboardShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useDashboardShell must be used within DashboardShell");
  return ctx;
}

type DashboardShellProps = {
  user: DashboardUser;
  children: ReactNode;
};

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo(
    () => ({
      user,
      collapsed,
      mobileOpen,
      toggleCollapsed,
      toggleMobile,
      closeMobile,
    }),
    [user, collapsed, mobileOpen, toggleCollapsed, toggleMobile, closeMobile]
  );

  return (
    <ShellContext.Provider value={value}>
      <RealtimeProvider>
        <div
          className="dashboard-root"
          data-collapsed={collapsed ? "true" : "false"}
          data-mobile-open={mobileOpen ? "true" : "false"}
        >
          {children}
        </div>
      </RealtimeProvider>
    </ShellContext.Provider>
  );
}
