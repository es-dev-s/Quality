const EXACT_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/audit-logs": "Audit Logs",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/settings": "Settings",
  "/forms": "Forms",
  "/forms/audit": "Audit Form",
  "/forms/templates": "Templates",
  "/import": "Import",
  "/admin/users": "Users",
  "/admin/roles": "Roles",
  "/admin/access": "Access",
};

export function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith("/audit-logs/") && pathname.endsWith("/edit")) {
    return "Edit Audit";
  }
  if (pathname.startsWith("/forms/audit/")) {
    return "Audit Form";
  }
  return EXACT_TITLES[pathname] ?? "Quality Audit";
}
