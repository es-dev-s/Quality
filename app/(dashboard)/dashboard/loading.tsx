import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function DashboardRouteLoading() {
  return (
    <PageFrame>
      <CardsPageSkeleton />
    </PageFrame>
  );
}
