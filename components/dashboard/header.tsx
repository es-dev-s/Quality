"use client";

import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/primitives/button";
import { NavbarUserMenu } from "@/components/dashboard/navbar-user-menu";
import { useDashboardShell } from "@/components/dashboard/shell";
import { resolvePageTitle } from "@/lib/page-titles";

type DashboardToolbarProps = {
  actions?: React.ReactNode;
};

export function DashboardToolbar({ actions }: DashboardToolbarProps) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, toggleMobile } = useDashboardShell();
  const title = resolvePageTitle(pathname);

  return (
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar__start">
        <Button
          variant="ghost"
          size="icon"
          className="ui-btn--mobile-only"
          onClick={toggleMobile}
          aria-label="Open menu"
        >
          <Menu size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="ui-btn--desktop-only"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </Button>

        <h1 className="dashboard-toolbar__title">{title}</h1>
      </div>

      <div className="dashboard-toolbar__end">
        {actions ? <div className="dashboard-toolbar__actions">{actions}</div> : null}
        <NavbarUserMenu />
      </div>
    </div>
  );
}

/** @deprecated Use DashboardToolbar */
export const DashboardHeader = DashboardToolbar;
