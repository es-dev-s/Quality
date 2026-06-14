import { Suspense } from "react";
import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { DashboardChromeFallback } from "@/components/dashboard/dashboard-chrome-fallback";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardChromeFallback>{children}</DashboardChromeFallback>}>
      <DashboardChrome>{children}</DashboardChrome>
    </Suspense>
  );
}
