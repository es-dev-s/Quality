import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { QmsAnalytics } from "@/components/analytics/qms-analytics";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAnalyticsData } from "@/lib/actions/analytics";

async function AnalyticsContent() {
  const session = await requirePageAccess("/analytics");
  const data = await getAnalyticsData();
  return (
    <QmsAnalytics
      data={data}
      roleSlug={session.user.role.slug}
    />
  );
}

export default function AnalyticsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<CardsPageSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </PageFrame>
  );
}
