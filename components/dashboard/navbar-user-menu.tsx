"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { CLEAR_SESSION_PATH } from "@/lib/auth-redirects";
import { useDashboardShell } from "@/components/dashboard/shell";
import { useToast } from "@/components/primitives/toast";

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

export function NavbarUserMenu() {
  const { user } = useDashboardShell();
  const { dismissPasswordToasts } = useToast();
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
    <div className="user-menu navbar-user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__trigger navbar-user-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="user-menu__meta">
          <p className="user-menu__name">{user.name ?? "User"}</p>
          <p className="user-menu__role">{user.role.name}</p>
        </span>
        <span className="user-menu__avatar">{getInitials(user.name, user.email)}</span>
      </button>

      {open ? (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__dropdown-head">
            <p className="user-menu__name">{user.name ?? "User"}</p>
            <p className="user-menu__dropdown-email">{user.email}</p>
          </div>
          <button
            type="button"
            className="user-menu__signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              dismissPasswordToasts();
              window.location.assign(CLEAR_SESSION_PATH);
            }}
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
