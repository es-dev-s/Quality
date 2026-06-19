import { redirect } from "next/navigation";
import { IMPORT_ENABLED } from "@/lib/constants";
import { PageFrame } from "@/components/dashboard/page-frame";
import { DataImportPanel } from "@/components/import/data-import-panel";
import { getRolesForSelect } from "@/lib/actions/admin";
import { requirePageAccess } from "@/lib/auth-guards";

export default async function ImportPage() {
  if (!IMPORT_ENABLED) {
    redirect("/dashboard");
  }

  const session = await requirePageAccess("/import");
  const roles = await getRolesForSelect();

  if (Array.isArray(roles)) {
    return (
      <PageFrame>
        <DataImportPanel roles={roles} />
      </PageFrame>
    );
  }

  redirect("/dashboard");
}
