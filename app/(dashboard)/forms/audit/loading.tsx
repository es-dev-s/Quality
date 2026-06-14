import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";

export default function AuditFormRouteLoading() {
  return (
    <PageFrame title="Audit Form" description="Score a call or chat interaction">
      <AuditFormSkeleton />
    </PageFrame>
  );
}
