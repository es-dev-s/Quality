import { PageFrame } from "@/components/dashboard/page-frame";
import { FormsHubSkeleton } from "@/components/dashboard/page-skeletons";

export default function FormsRouteLoading() {
  return (
    <PageFrame>
      <FormsHubSkeleton />
    </PageFrame>
  );
}
