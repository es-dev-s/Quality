import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { FormsHubSkeleton } from "@/components/dashboard/page-skeletons";
import { FormsHub } from "@/components/forms/forms-hub";
import { requirePageAccess } from "@/lib/auth-guards";
import { getFormsPageData } from "@/lib/actions/templates";

async function FormsHubContent() {
  await requirePageAccess("/forms");
  const { templates, activeTemplateId, canManage, scopeSummary } = await getFormsPageData();
  return (
    <FormsHub
      templates={templates}
      activeTemplateId={activeTemplateId}
      canManage={canManage}
      scopeSummary={scopeSummary}
    />
  );
}

export default function FormsPage() {
  return (
    <PageFrame>
      <Suspense fallback={<FormsHubSkeleton />}>
        <FormsHubContent />
      </Suspense>
    </PageFrame>
  );
}
