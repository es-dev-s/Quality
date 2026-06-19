import { PageFrame } from "@/components/dashboard/page-frame";
import { SettingsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function SettingsRouteLoading() {
  return (
    <PageFrame>
      <SettingsPageSkeleton />
    </PageFrame>
  );
}
