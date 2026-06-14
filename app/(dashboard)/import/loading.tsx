import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function ImportRouteLoading() {
  return (
    <PageFrame
      title="Import"
      description="Bulk import users with roles from CSV or JSON"
    >
      <TablePageSkeleton rows={8} />
    </PageFrame>
  );
}
