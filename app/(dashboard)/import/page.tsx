import { redirect } from "next/navigation";
import { PageFrame } from "@/components/dashboard/page-frame";
import { DataImportPanel } from "@/components/import/data-import-panel";
import { getRolesForSelect } from "@/lib/actions/admin";
import { requirePageAccess } from "@/lib/auth-guards";

export default async function ImportPage() {
  const session = await requirePageAccess("/import");
  const roles = await getRolesForSelect();

  if (Array.isArray(roles)) {
    return (
      <PageFrame
        title="Import"
        description="Bulk import users with name, email, password, and role"
      >
        <DataImportPanel roles={roles} />
      </PageFrame>
    );
  }

  redirect("/dashboard");
}
