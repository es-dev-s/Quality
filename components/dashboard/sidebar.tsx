"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PhoneCall,
  Plus,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canWriteAuditTemplates,
} from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { hasScope } from "@/lib/rbac";
import { useDashboardShell } from "@/components/dashboard/shell";

const mainNav = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.OVERVIEW_READ,
  },
  {
    title: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    permission: PERMISSIONS.AUDIT_LOGS_READ,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: PERMISSIONS.ANALYTICS_READ,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
    permission: PERMISSIONS.REPORTS_READ,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: PERMISSIONS.SETTINGS_READ,
  },
] as const;

const formNav = [
  {
    title: "Audit Form",
    href: "/forms/audit",
    meta: "Score an interaction",
    icon: PhoneCall,
    permission: PERMISSIONS.AUDIT_FORM_READ,
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  childActive,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  childActive?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        "dashboard-nav-link",
        active && "dashboard-nav-link--active",
        childActive && "dashboard-nav-link--child-active",
        collapsed && "dashboard-nav-link--collapsed"
      )}
    >
      <Icon size={16} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function FormSubLink({
  href,
  label,
  meta,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  meta: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onNavigate}
      className={cn("forms-nav-sub-link", active && "forms-nav-sub-link--active")}
    >
      <Icon size={15} aria-hidden />
      <span className="forms-nav-sub-link__text">
        <span className="forms-nav-sub-link__label">{label}</span>
        <span className="forms-nav-sub-link__meta">{meta}</span>
      </span>
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, collapsed, mobileOpen, closeMobile } = useDashboardShell();

  const showTemplateAdmin = canWriteAuditTemplates(user.role);
  const visibleMainNav = mainNav.filter((item) =>
    hasScope(user.role, item.permission)
  );
  const showFormsHub =
    hasScope(user.role, PERMISSIONS.AUDIT_FORM_READ) ||
    hasScope(user.role, PERMISSIONS.AUDIT_TEMPLATES_READ);
  const visibleFormNav = formNav.filter((item) =>
    hasScope(user.role, item.permission)
  );
  const formsActive = pathname.startsWith("/forms");

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="dashboard-overlay"
          onClick={closeMobile}
        />
      )}
      <aside className="dashboard-sidebar">
        <div
          className={cn(
            "dashboard-sidebar__brand",
            collapsed && "dashboard-sidebar__brand--collapsed"
          )}
        >
          <Link href="/dashboard" prefetch onClick={closeMobile} className="dashboard-sidebar__logo">
            QA
          </Link>
          {!collapsed && (
            <div className="dashboard-sidebar__brand-text">
              <p className="dashboard-sidebar__brand-name">Quality Audit</p>
              <p className="dashboard-sidebar__brand-sub">Admin Platform</p>
            </div>
          )}
        </div>

        <nav className="dashboard-sidebar__nav">
          {visibleMainNav.length > 0 && (
            <div>
              {!collapsed && (
                <p className="dashboard-sidebar__section-label">Main</p>
              )}
              <div className="dashboard-sidebar__links">
                {visibleMainNav.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.title}
                    icon={item.icon}
                    active={pathname === item.href}
                    collapsed={collapsed}
                    onNavigate={closeMobile}
                  />
                ))}
              </div>
            </div>
          )}

          {showFormsHub && (
            <div>
              {!collapsed && (
                <p className="dashboard-sidebar__section-label">Forms</p>
              )}
              <div className="forms-nav-group">
                <div className="dashboard-sidebar__links">
                  <NavLink
                    href="/forms"
                    label="Forms"
                    icon={ClipboardList}
                    active={pathname === "/forms"}
                    childActive={formsActive && pathname !== "/forms"}
                    collapsed={collapsed}
                    onNavigate={closeMobile}
                  />
                </div>
                {!collapsed && (
                  <div className="forms-nav-sub">
                    {visibleFormNav.map((item) => (
                      <FormSubLink
                        key={item.href}
                        href={item.href}
                        label={item.title}
                        meta={item.meta}
                        icon={item.icon}
                        active={
                          pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)
                        }
                        onNavigate={closeMobile}
                      />
                    ))}
                    {showTemplateAdmin && (
                      <Link
                        href="/forms/templates?new=1"
                        prefetch
                        onClick={closeMobile}
                        className={cn(
                          "forms-nav-create",
                          pathname.startsWith("/forms/templates") &&
                            "forms-nav-create--active"
                        )}
                      >
                        <Plus size={15} aria-hidden />
                        <span className="forms-nav-create__text">
                          <span className="forms-nav-create__label">
                            Create template
                          </span>
                          <span className="forms-nav-create__meta">
                            Build & assign to roles
                          </span>
                        </span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
