import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireAuth } from "@/lib/auth";
import {
  isInvalidSessionError,
  invalidSessionRedirectReason,
} from "@/lib/auth-guards";
import { redirectForInvalidSession } from "@/lib/auth-redirects";
import { rethrowNextNavigation } from "@/lib/next-errors";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await requireAuth();

    return (
      <DashboardShell user={session.user}>
        <DashboardSidebar />
        {children}
      </DashboardShell>
    );
  } catch (error) {
    rethrowNextNavigation(error);

    if (isInvalidSessionError(error)) {
      redirectForInvalidSession(undefined, invalidSessionRedirectReason(error));
    }

    // Only clear cookies when the session is actually invalid — not on slow DB.
    if (error instanceof Error && error.message === "Unauthorized") {
      redirectForInvalidSession(undefined, "session");
    }

    console.error("[dashboard] auth lookup failed:", error);
    redirect("/login");
  }
}
