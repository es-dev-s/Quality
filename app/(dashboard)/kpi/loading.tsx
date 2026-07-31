import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function KpiRouteLoading() {
  return (
    <PageFrame fill>
      <TablePageSkeleton rows={8} />
    </PageFrame>
  );
}
