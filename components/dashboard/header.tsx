"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOutAction } from "@/lib/actions/admin";
import { Button } from "@/components/primitives/button";
import { useDashboardShell } from "@/components/dashboard/shell";

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email?.slice(0, 2).toUpperCase() ?? "U";
}

export function DashboardHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const { user, collapsed, toggleCollapsed, toggleMobile } = useDashboardShell();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="dashboard-header">
      <Button
        variant="ghost"
        size="icon"
        className="ui-btn--mobile-only"
        onClick={toggleMobile}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="ui-btn--desktop-only"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </Button>

      <div className="dashboard-header__titles">
        <h1 className="dashboard-header__title">{title}</h1>
        {description && <p className="dashboard-header__desc">{description}</p>}
      </div>

      <div ref={menuRef} className="user-menu">
        <button
          type="button"
          className="user-menu__trigger"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="user-menu__meta">
            <p className="user-menu__name">{user.name ?? "User"}</p>
            <p className="user-menu__role">{user.role.name}</p>
          </div>
          <span className="user-menu__avatar">
            {getInitials(user.name, user.email)}
          </span>
        </button>

        {open && (
          <div className="user-menu__dropdown">
            <div className="user-menu__dropdown-head">
              <p className="user-menu__name">{user.name}</p>
              <p className="user-menu__dropdown-email">{user.email}</p>
            </div>
            <button
              type="button"
              className="user-menu__signout"
              onClick={() => {
                setOpen(false);
                void signOutAction();
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
