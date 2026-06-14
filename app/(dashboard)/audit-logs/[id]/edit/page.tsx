import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";
import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditForm } from "@/components/forms/audit-form";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditors, getAuditForEdit } from "@/lib/actions/audit";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { getAuditFormWorkbench } from "@/lib/actions/templates";

type EditAuditPageProps = {
  params: Promise<{ id: string }>;
};

async function EditAuditContent({ id }: { id: string }) {
  await requirePageAccess("/forms/audit");
  const [editData, workbench, auditors, interactionConfig] = await Promise.all([
    getAuditForEdit(id),
    getAuditFormWorkbench(),
    getAuditors(),
    getInteractionConfig(),
  ]);

  if (!editData) {
    notFound();
  }

  return (
    <AuditForm
      auditors={auditors}
      interactionConfig={interactionConfig}
      templates={workbench.templates}
      initialTemplateId={editData.templateId}
      initialType={editData.formData.type}
      editAuditId={editData.id}
      editAuditCode={editData.auditCode}
      initialFormData={editData.formData}
      initialScores={editData.scores}
      successRedirect="/audit-logs"
      cancelHref="/audit-logs"
    />
  );
}

export default async function EditAuditPage({ params }: EditAuditPageProps) {
  const { id } = await params;

  return (
    <PageFrame
      title="Edit audit"
      description="Update interaction details and scoring, then save changes"
    >
      <Suspense fallback={<AuditFormSkeleton />}>
        <EditAuditContent id={id} />
      </Suspense>
    </PageFrame>
  );
}
