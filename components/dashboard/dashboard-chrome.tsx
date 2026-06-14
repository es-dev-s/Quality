import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import { DashboardShell } from "@/components/dashboard/shell";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export async function DashboardChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session.user}>
      <DashboardSidebar />
      {children}
    </DashboardShell>
  );
}
