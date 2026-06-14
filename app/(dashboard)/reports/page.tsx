import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { ExecutiveReport } from "@/components/reports/executive-report";
import { requirePageAccess } from "@/lib/auth-guards";

async function ReportsContent() {
  await requirePageAccess("/reports");
  return <ExecutiveReport />;
}

export default function ReportsPage() {
  return (
    <PageFrame
      title="Reports"
      description="Executive performance snapshot with date range, pass rate, and export"
    >
      <Suspense fallback={<TablePageSkeleton rows={10} />}>
        <ReportsContent />
      </Suspense>
    </PageFrame>
  );
}
