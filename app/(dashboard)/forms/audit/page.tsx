import { Suspense } from "react";
import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";
import { AuditForm } from "@/components/forms/audit-form";
import { QmsEmpty } from "@/components/analytics/qms-primitives";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditors, getAuditReferenceOptions } from "@/lib/actions/audit";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { getAuditFormWorkbench } from "@/lib/actions/templates";
import { resolveAuditFormTemplateId } from "@/lib/audit/audit-form-utils";
import { fetchMemberGrantedQaNames } from "@/lib/audit/member-access";
import { buildSupervisorAgentMap } from "@/lib/audit/supervisor-agent-map";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { resolveAuditSaveRedirect } from "@/lib/rbac";
import type { InteractionType } from "@/lib/audit/types";

type AuditFormPageProps = {
  searchParams: Promise<{ type?: string; template?: string }>;
};

function parseInitialType(value?: string): InteractionType | undefined {
  if (value === "call") return "Call";
  if (value === "Chat") return "Chat";
  return undefined;
}

async function AuditFormContent({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; template?: string }>;
}) {
  const session = await requirePageAccess("/forms/audit");
  const params = await searchParams;
  const initialType = parseInitialType(params.type);
  const isMember = session.user.role.slug === SYSTEM_ROLE_SLUGS.MEMBER;

  const [
    auditors,
    interactionConfig,
    workbench,
    auditReferenceOptions,
    grantedQaNames,
  ] = await Promise.all([
    getAuditors(),
    getInteractionConfig(),
    getAuditFormWorkbench(),
    getAuditReferenceOptions(),
    isMember ? fetchMemberGrantedQaNames(session.user.id) : Promise.resolve([]),
  ]);

  // Members act as a granted QA identity (auto-select when only one).
  const currentAuditorName = isMember
    ? grantedQaNames.length === 1
      ? grantedQaNames[0]!
      : ""
    : session.user.name?.trim() || session.user.email || "";

  if (workbench.templates.length === 0) {
    return (
      <QmsEmpty message="No audit templates are available for your role. Run npm run db:seed on the server, or ask an admin to assign template access." />
    );
  }

  const initialTemplateId = resolveAuditFormTemplateId(
    workbench.templates,
    workbench.activeTemplateId,
    {
      templateId: params.template,
      interactionType: initialType,
    }
  );

  const supervisorAgentMap = await buildSupervisorAgentMap(
    session,
    interactionConfig.supervisors,
    interactionConfig.agents
  );

  return (
    <AuditForm
      auditors={auditors}
      currentAuditorName={currentAuditorName}
      interactionConfig={interactionConfig}
      templates={workbench.templates}
      auditReferenceOptions={auditReferenceOptions}
      initialTemplateId={initialTemplateId}
      initialType={initialType}
      supervisorAgentMap={supervisorAgentMap}
      successRedirect={resolveAuditSaveRedirect(session.user.role)}
    />
  );
}

export default function AuditFormPage({ searchParams }: AuditFormPageProps) {
  return (
    <PageFrame flush>
      <Suspense fallback={<AuditFormSkeleton />}>
        <AuditFormContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
