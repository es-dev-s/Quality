import { PageFrame } from "@/components/dashboard/page-frame";
import { SettingsPageSkeleton } from "@/components/dashboard/page-skeletons";

export default function SettingsRouteLoading() {
  return (
    <PageFrame
      title="Settings"
      description="Agents, users, roles, and interaction config for audit forms"
    >
      <SettingsPageSkeleton />
    </PageFrame>
  );
}
