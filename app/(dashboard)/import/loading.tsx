import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function ImportRouteLoading() {
  return (
    <PageFrame>
      <TablePageSkeleton rows={8} />
    </PageFrame>
  );
}
