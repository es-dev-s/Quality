import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireAuth } from "@/lib/auth";
import { isInvalidSessionError, invalidSessionRedirectReason } from "@/lib/auth-guards";
import { redirectForInvalidSession } from "@/lib/auth-redirects";

const AUTH_LOOKUP_MS = 8_000;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await Promise.race([
      requireAuth(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Auth lookup timed out")),
          AUTH_LOOKUP_MS
        );
      }),
    ]);

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

    // Stale cookie / slow DB — clear session cookies so /login can load.
    redirectForInvalidSession(undefined, "session");
  }
}
