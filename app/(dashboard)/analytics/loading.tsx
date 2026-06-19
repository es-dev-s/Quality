import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function AnalyticsRouteLoading() {
  return (
    <PageFrame>
      <CardsPageSkeleton />
    </PageFrame>
  );
}
