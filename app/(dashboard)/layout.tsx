import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireAuth } from "@/lib/auth";
import { isInvalidSessionError, invalidSessionRedirectReason } from "@/lib/auth-guards";
import { redirectForInvalidSession } from "@/lib/auth-redirects";

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
    if (isInvalidSessionError(error)) {
      redirectForInvalidSession(undefined, invalidSessionRedirectReason(error));
    }

    redirect("/login");
  }
}
