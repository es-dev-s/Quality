import { PageFrame } from "@/components/dashboard/page-frame";
import { TablePageSkeleton } from "@/components/dashboard/page-skeletons";

export default function AuditLogsRouteLoading() {
  return (
    <PageFrame
      title="Audit Logs"
      description="Browse recent saved audits, scores, and submission history"
    >
      <TablePageSkeleton rows={12} />
    </PageFrame>
  );
}
