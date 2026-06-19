import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { requirePageAccess } from "@/lib/auth-guards";
import { getDashboardAuditData } from "@/lib/actions/audit";
import {
  canEditAuditSubmissions,
  canEditSupervisorRemarks,
} from "@/lib/rbac";

async function DashboardContent() {
  const session = await requirePageAccess("/dashboard");
  const data = await getDashboardAuditData();
  return (
    <DashboardAnalytics
      data={data}
      canEditAudits={canEditAuditSubmissions(session.user.role)}
      canEditSupervisorRemarks={canEditSupervisorRemarks(session.user.role)}
    />
  );
}

export default function DashboardPage() {
  return (
    <PageFrame>
      <Suspense fallback={<CardsPageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageFrame>
  );
}
