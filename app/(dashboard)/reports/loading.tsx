import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function ReportsRouteLoading() {
  return (
    <PageFrame
      title="Reports"
      description="Executive performance snapshot with date range, pass rate, and export"
    >
      <TablePageSkeleton rows={10} />
    </PageFrame>
  );
}
