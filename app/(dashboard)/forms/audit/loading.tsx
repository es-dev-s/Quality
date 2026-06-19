import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";

export default function AuditFormRouteLoading() {
  return (
    <PageFrame flush>
      <AuditFormSkeleton />
    </PageFrame>
  );
}
