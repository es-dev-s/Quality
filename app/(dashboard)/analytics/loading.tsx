import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function AnalyticsRouteLoading() {
  return (
    <PageFrame
      title="Analytics"
      description="QMS performance insights — overview, parameters, teams, agents, compliance, and auditors"
    >
      <CardsPageSkeleton />
    </PageFrame>
  );
}
