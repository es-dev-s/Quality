import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";
import { QmsAnalytics } from "@/components/analytics/qms-analytics";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAnalyticsData } from "@/lib/actions/analytics";

async function AnalyticsContent() {
  await requirePageAccess("/analytics");
  const data = await getAnalyticsData();
  return <QmsAnalytics data={data} />;
}

export default function AnalyticsPage() {
  return (
    <PageFrame
      title="Analytics"
      description="QMS performance insights — overview, parameters, teams, agents, compliance, and auditors"
    >
      <Suspense fallback={<CardsPageSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </PageFrame>
  );
}
