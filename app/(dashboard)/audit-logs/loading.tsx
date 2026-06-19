import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function AuditLogsRouteLoading() {
  return (
    <PageFrame>
      <TablePageSkeleton rows={12} />
    </PageFrame>
  );
}
