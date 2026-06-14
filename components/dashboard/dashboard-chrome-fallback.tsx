import { PERMISSIONS } from "@/lib/permissions";
import type { SessionRole } from "@/lib/rbac";
import { DashboardShell } from "@/components/dashboard/shell";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

/** Keeps sidebar navigation clickable while session resolves. Pages remain server-guarded. */
const LOADING_SHELL_ROLE: SessionRole = {
  id: "loading",
  name: "Loading",
  slug: "loading",
  scopes: Object.values(PERMISSIONS),
};

export function DashboardChromeFallback({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      user={{
        name: null,
        email: null,
        role: LOADING_SHELL_ROLE,
      }}
    >
      <DashboardSidebar />
      {children}
    </DashboardShell>
  );
}
