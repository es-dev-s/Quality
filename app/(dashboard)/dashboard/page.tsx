import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { getDashboardPageData } from "@/lib/actions/dashboard";
import { requirePageAccess } from "@/lib/auth-guards";
import {
	canEditAuditSubmissions,
	canEditSupervisorRemarks,
} from "@/lib/rbac";
import { Suspense } from "react";

async function DashboardContent() {
  const session = await requirePageAccess("/dashboard");
  const data = await getDashboardPageData();
  return (
    <DashboardAnalytics
      data={data}
      roleSlug={session.user.role.slug}
      canEditAudits={canEditAuditSubmissions(session.user.role)}
      canEditSupervisorRemarks={canEditSupervisorRemarks(session.user.role)}
      viewerUserId={session.user.id}
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
