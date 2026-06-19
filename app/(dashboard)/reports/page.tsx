import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";
import { ExecutiveReport } from "@/components/reports/executive-report";
import { requirePageAccess } from "@/lib/auth-guards";
import { canExportAuditData } from "@/lib/rbac";

async function ReportsContent() {
  const session = await requirePageAccess("/reports");
  return (
    <ExecutiveReport canExport={canExportAuditData(session.user.role)} />
  );
}

export default function ReportsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<TablePageSkeleton rows={10} />}>
        <ReportsContent />
      </Suspense>
    </PageFrame>
  );
}
