import { redirect } from "next/navigation";
import { IMPORT_ENABLED } from "@/lib/constants";
import { PageFrame } from "@/components/dashboard/page-frame";
import { ImportHub } from "@/components/import/import-hub";
import { getRolesForSelect } from "@/lib/actions/admin";
import { getAuditImportContext } from "@/lib/actions/import-audits";
import { requireSuperAdmin } from "@/lib/auth";

export default async function ImportPage() {
  if (!IMPORT_ENABLED) {
    redirect("/dashboard");
  }

  await requireSuperAdmin();
  const [roles, auditContext] = await Promise.all([
    getRolesForSelect(),
    getAuditImportContext(),
  ]);

  if (Array.isArray(roles)) {
    return (
      <PageFrame>
        <ImportHub
          roles={roles}
          templates={auditContext.templates}
          templateBodies={auditContext.templateBodies}
          entityCatalog={auditContext.entityCatalog}
        />
      </PageFrame>
    );
  }

  redirect("/dashboard");
}
