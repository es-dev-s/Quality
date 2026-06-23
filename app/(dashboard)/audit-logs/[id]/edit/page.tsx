import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";
import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditForm } from "@/components/forms/audit-form";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditors, getAuditForEdit, getAuditReferenceOptions } from "@/lib/actions/audit";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { getAuditFormWorkbenchForEdit } from "@/lib/actions/templates";
import { buildSupervisorAgentMap } from "@/lib/audit/supervisor-agent-map";
import { canEditAuditSubmissions } from "@/lib/rbac";

type EditAuditPageProps = {
  params: Promise<{ id: string }>;
};

async function EditAuditContent({ id }: { id: string }) {
  const session = await requirePageAccess("/audit-logs");
  if (!canEditAuditSubmissions(session.user.role)) {
    redirect("/access-denied");
  }

  const editData = await getAuditForEdit(id);
  if (!editData) {
    redirect("/audit-logs");
  }

  const [workbench, auditors, interactionConfig, auditReferenceOptions] =
    await Promise.all([
      getAuditFormWorkbenchForEdit(editData.templateId),
      getAuditors(),
      getInteractionConfig(),
      getAuditReferenceOptions(),
    ]);

  const supervisorAgentMap = await buildSupervisorAgentMap(
    session,
    interactionConfig.supervisors,
    interactionConfig.agents
  );

  return (
    <AuditForm
      auditors={auditors}
      currentAuditorName={
        session.user.name?.trim() || session.user.email || ""
      }
      interactionConfig={interactionConfig}
      templates={workbench.templates}
      auditReferenceOptions={auditReferenceOptions}
      initialTemplateId={editData.templateId}
      initialType={editData.formData.type}
      editAuditId={editData.id}
      editAuditCode={editData.auditCode}
      initialFormData={editData.formData}
      initialScores={editData.scores}
      successRedirect="/audit-logs"
      cancelHref="/audit-logs"
      supervisorAgentMap={supervisorAgentMap}
    />
  );
}

export default async function EditAuditPage({ params }: EditAuditPageProps) {
  const { id } = await params;

  return (
    <PageFrame flush>
      <Suspense fallback={<AuditFormSkeleton />}>
        <EditAuditContent id={id} />
      </Suspense>
    </PageFrame>
  );
}
