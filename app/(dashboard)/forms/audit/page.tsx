import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/dashboard/page-frame";
import { AuditFormSkeleton } from "@/components/dashboard/page-skeletons";
import { AuditForm } from "@/components/forms/audit-form";
import { requirePageAccess } from "@/lib/auth-guards";
import { getAuditors } from "@/lib/actions/audit";
import { getInteractionConfig } from "@/lib/actions/interaction-config";
import { getAuditFormWorkbench } from "@/lib/actions/templates";
import { resolveAuditFormTemplateId } from "@/lib/audit/audit-form-utils";
import type { InteractionType } from "@/lib/audit/types";

type AuditFormPageProps = {
  searchParams: Promise<{ type?: string; template?: string }>;
};

function parseInitialType(value?: string): InteractionType | undefined {
  if (value === "Call") return "Call";
  if (value === "Chat") return "Chat";
  return undefined;
}

async function AuditFormContent({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; template?: string }>;
}) {
  await requirePageAccess("/forms/audit");
  const params = await searchParams;
  const initialType = parseInitialType(params.type);

  const [auditors, interactionConfig, workbench] = await Promise.all([
    getAuditors(),
    getInteractionConfig(),
    getAuditFormWorkbench(),
  ]);

  if (workbench.templates.length === 0) {
    notFound();
  }

  const initialTemplateId = resolveAuditFormTemplateId(
    workbench.templates,
    workbench.activeTemplateId,
    {
      templateId: params.template,
      interactionType: initialType,
    }
  );

  return (
    <AuditForm
      auditors={auditors}
      interactionConfig={interactionConfig}
      templates={workbench.templates}
      initialTemplateId={initialTemplateId}
      initialType={initialType}
    />
  );
}

export default function AuditFormPage({ searchParams }: AuditFormPageProps) {
  return (
    <PageFrame title="Audit Form" description="Score a call or chat interaction">
      <Suspense fallback={<AuditFormSkeleton />}>
        <AuditFormContent searchParams={searchParams} />
      </Suspense>
    </PageFrame>
  );
}
