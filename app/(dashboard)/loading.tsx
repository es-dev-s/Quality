import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function DashboardSegmentLoading() {
  return (
    <PageFrame title="Loading" description="Loading page content…">
      <CardsPageSkeleton />
    </PageFrame>
  );
}
