"use client";

import { useState } from "react";
import { ClipboardList, Users } from "lucide-react";
import { AuditImportPanel } from "@/components/import/audit-import-panel";
import { DataImportPanel as UserImportPanel } from "@/components/import/data-import-panel";
import type { AuditImportTemplateOption } from "@/lib/import/audit-import-types";
import type { RoleImportOption } from "@/lib/import/user-import-types";
import type { AuditTemplate } from "@/lib/audit/types";
import { cn } from "@/lib/utils";

type ImportTab = "audits" | "users";

type ImportHubProps = {
  roles: RoleImportOption[];
  templates: AuditImportTemplateOption[];
  templateBodies: Record<string, AuditTemplate>;
};

export function ImportHub({
  roles,
  templates,
  templateBodies,
}: ImportHubProps) {
  const [tab, setTab] = useState<ImportTab>("audits");

  return (
    <div className="import-hub">
      <div className="import-hub__tabs" role="tablist" aria-label="Import type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "audits"}
          className={cn(
            "import-hub__tab",
            tab === "audits" && "import-hub__tab--active"
          )}
          onClick={() => setTab("audits")}
        >
          <ClipboardList size={16} aria-hidden />
          Audit forms
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "users"}
          className={cn(
            "import-hub__tab",
            tab === "users" && "import-hub__tab--active"
          )}
          onClick={() => setTab("users")}
        >
          <Users size={16} aria-hidden />
          Users
        </button>
      </div>

      {tab === "audits" ? (
        <AuditImportPanel templates={templates} templateBodies={templateBodies} />
      ) : (
        <UserImportPanel roles={roles} />
      )}
    </div>
  );
}
