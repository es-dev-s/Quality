import { Suspense } from "react";
import Link from "next/link";
import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics";
import { requirePageAccess } from "@/lib/auth-guards";
import { getDashboardAuditData } from "@/lib/actions/audit";
import { canWriteAuditForm } from "@/lib/rbac";

async function DashboardContent() {
  await requirePageAccess("/dashboard");
  const data = await getDashboardAuditData();
  return <DashboardAnalytics data={data} />;
}

export default function DashboardPage() {
  return (
    <PageFrame
      title="Dashboard"
      description="Quality performance overview with trends, distribution, and audit targets"
    >
      <DashboardActions />
      <Suspense fallback={<CardsPageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageFrame>
  );
}

async function DashboardActions() {
  const session = await requirePageAccess("/dashboard");
  if (!canWriteAuditForm(session.user.role)) {
    return null;
  }
  return (
    <div className="dash-header-actions">
      <Link href="/forms/audit" className="ui-btn ui-btn--primary ui-btn--sm">
        New audit
      </Link>
    </div>
  );
}
