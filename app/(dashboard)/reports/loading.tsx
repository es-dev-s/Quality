import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function ReportsRouteLoading() {
  return (
    <PageFrame>
      <TablePageSkeleton rows={10} />
    </PageFrame>
  );
}
