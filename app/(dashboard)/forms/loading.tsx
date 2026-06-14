import { PageFrame } from "@/components/dashboard/page-frame";
import { FormsHubSkeleton } from "@/components/dashboard/page-skeletons";

export default function FormsRouteLoading() {
  return (
    <PageFrame
      title="Forms"
      description="Select an audit form assigned to your role and begin scoring"
    >
      <FormsHubSkeleton />
    </PageFrame>
  );
}
