import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function DashboardRouteLoading() {
  return (
    <PageFrame
      title="Dashboard"
      description="Quality performance overview with trends, distribution, and audit targets"
    >
      <CardsPageSkeleton />
    </PageFrame>
  );
}
