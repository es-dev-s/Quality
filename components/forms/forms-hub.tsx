"use client";

import Link from "next/link";
import { FileText, Plus, Settings2 } from "lucide-react";
import type { TemplateListItem } from "@/lib/actions/templates";
import { cn } from "@/lib/utils";

import type { FormsScopeSummary } from "@/lib/audit/interaction-config-people";

type FormsHubProps = {
  templates: TemplateListItem[];
  activeTemplateId: string;
  canManage: boolean;
  scopeSummary: FormsScopeSummary;
};

export function FormsHub({
  templates,
  activeTemplateId,
  canManage,
  scopeSummary,
}: FormsHubProps) {
  if (templates.length === 0) {
    return (
      <div className="forms-hub__empty">
        <FileText size={32} strokeWidth={1.5} aria-hidden />
        <h2 className="forms-hub__empty-title">No forms available</h2>
        <p className="forms-hub__empty-desc">
          {canManage
            ? "Create a template and assign it to a role so users can start auditing."
            : "Your role does not have any audit forms assigned yet. Contact an administrator."}
        </p>
        {canManage && (
          <Link href="/forms/templates?new=1" className="ui-btn ui-btn--primary ui-btn--sm">
            <Plus size={16} aria-hidden />
            Create template
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="forms-hub">
      <div className="forms-hub__scope" role="status">
        <span className="forms-hub__scope-label">Your scope</span>
        <span className="forms-hub__scope-meta">
          {scopeSummary.agentCount} agent{scopeSummary.agentCount === 1 ? "" : "s"}
          {" · "}
          {scopeSummary.supervisorCount} supervisor
          {scopeSummary.supervisorCount === 1 ? "" : "s"}
          {" · "}
          {scopeSummary.analystCount} analyst
          {scopeSummary.analystCount === 1 ? "" : "s"}
        </span>
        <span className="forms-hub__scope-role">{scopeSummary.roleLabel}</span>
      </div>

      {canManage && (
        <div className="forms-hub__toolbar">
          <p className="forms-hub__toolbar-text">
            {templates.length} form{templates.length === 1 ? "" : "s"} available
          </p>
          <Link href="/forms/templates?new=1" className="ui-btn ui-btn--primary ui-btn--sm">
            <Plus size={16} aria-hidden />
            Create template
          </Link>
        </div>
      )}

      <div className="forms-hub__grid">
        {templates.map((form) => {
          const isActive = form.id === activeTemplateId;
          const paramCount = form.sections.reduce(
            (n, s) => n + s.params.length,
            0
          );

          return (
            <Link
              key={form.id}
              href={`/forms/audit?template=${encodeURIComponent(form.id)}`}
              className={cn("forms-hub__card", isActive && "forms-hub__card--active")}
            >
              <div className="forms-hub__card-top">
                <span className="forms-hub__card-type">{form.type}</span>
                {isActive && <span className="forms-hub__card-badge">Active</span>}
                {form.isDefault && (
                  <span className="forms-hub__card-badge forms-hub__card-badge--muted">
                    Default
                  </span>
                )}
              </div>
              <h3 className="forms-hub__card-name">{form.name}</h3>
              <p className="forms-hub__card-desc">
                {form.description || "No description provided."}
              </p>
              <div className="forms-hub__card-meta">
                <span>{form.sections.length} sections</span>
                <span>{paramCount} parameters</span>
              </div>
              {!form.isDefault && form.roleNames.length > 0 && (
                <p className="forms-hub__card-roles">
                  Roles: {form.roleNames.join(", ")}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {canManage && (
        <Link href="/forms/templates" className="forms-hub__manage">
          <Settings2 size={16} aria-hidden />
          Manage all templates
        </Link>
      )}
    </div>
  );
}
