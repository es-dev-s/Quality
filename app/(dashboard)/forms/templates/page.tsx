import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { FormsHubSkeleton } from "@/components/dashboard/page-skeletons";
import { AuditTemplatesManager } from "@/components/templates/audit-templates-manager";
import { requirePageAccess } from "@/lib/auth-guards";
import { getTemplatesManagerData } from "@/lib/actions/templates";

type FormTemplatesPageProps = {
  searchParams: Promise<{ new?: string }>;
};

async function TemplatesContent({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  await requirePageAccess("/forms/templates");
  const { new: newParam } = await searchParams;
  const { templates, activeTemplateId, canManage, roleOptions } =
    await getTemplatesManagerData();

  return (
    <AuditTemplatesManager
      templates={templates}
      activeTemplateId={activeTemplateId}
      canManage={canManage}
      roleOptions={roleOptions}
      startWithNew={newParam === "1"}
    />
  );
}

export default function FormTemplatesPage({
  searchParams,
}: FormTemplatesPageProps) {
  return (
    <PageFrame>
      <Suspense fallback={<FormsHubSkeleton />}>
        <TemplatesContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
