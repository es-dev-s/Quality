import { PageFrame } from "@/components/dashboard/page-frame";
import { CardsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function DashboardGroupLoading() {
  return (
    <PageFrame>
      <CardsPageSkeleton />
    </PageFrame>
  );
}
