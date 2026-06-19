"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Edit,
  Plus,
  PlusCircle,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/primitives/button";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import {
  deleteTemplate,
  saveTemplate,
  setActiveTemplateId,
  type RoleOption,
  type TemplateListItem,
} from "@/lib/actions/templates";
import type {
  AuditParameter,
  AuditSection,
  AuditTemplate,
  ScoringScheme,
} from "@/lib/audit/types";
import { cn } from "@/lib/utils";

const SCORING_OPTIONS: { value: ScoringScheme; label: string }[] = [
  { value: "Y/N/NA", label: "Y / N / N/A" },
  { value: "Y/Fatal/NA", label: "Y / Fatal / N/A" },
  { value: "Y/N/Fatal/NA", label: "Y / N / Fatal / N/A" },
  { value: "EE/ME/BE/NA", label: "EE / ME / BE / N/A" },
  { value: "Y/N-CMM", label: "CMM (Y / N)" },
];

type AuditTemplatesManagerProps = {
  templates: TemplateListItem[];
  activeTemplateId: string;
  canManage: boolean;
  roleOptions: RoleOption[];
  startWithNew?: boolean;
};

function cloneTemplate(template: AuditTemplate): AuditTemplate {
  return JSON.parse(JSON.stringify(template)) as AuditTemplate;
}

function createBlankTemplate(): AuditTemplate {
  const sectionId = `s-${Date.now()}`;
  return {
    id: `tpl-${Date.now()}`,
    name: "New Custom Template",
    type: "Call / Chat",
    lob: "",
    description: "",
    isDefault: false,
    sections: [
      {
        id: sectionId,
        name: "New Section",
        isFatal: false,
        params: [],
      },
    ],
  };
}

export function AuditTemplatesManager({
  templates,
  activeTemplateId,
  canManage,
  roleOptions,
  startWithNew = false,
}: AuditTemplatesManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editingTemplate, setEditingTemplate] = useState<AuditTemplate | null>(
    null
  );
  const [editingRoleIds, setEditingRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (startWithNew && canManage && !editingTemplate) {
      setEditingTemplate(createBlankTemplate());
      setEditingRoleIds(roleOptions.map((r) => r.id));
    }
  }, [startWithNew, canManage, roleOptions, editingTemplate]);

  const openEditor = (tpl: TemplateListItem) => {
    setEditingTemplate(cloneTemplate(tpl));
    setEditingRoleIds(tpl.roleIds);
  };

  const openNewEditor = () => {
    setEditingTemplate(createBlankTemplate());
    setEditingRoleIds(roleOptions.map((r) => r.id));
  };

  const handleSetActive = (id: string) => {
    startTransition(async () => {
      const res = await setActiveTemplateId(id);
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      toast("Active template updated");
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      toast("Template deleted");
      router.refresh();
    });
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    startTransition(async () => {
      const res = await saveTemplate(editingTemplate, editingRoleIds);
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      toast("Template saved");
      setEditingTemplate(null);
      setEditingRoleIds([]);
      router.replace("/forms/templates");
      router.refresh();
    });
  };

  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        roleIds={editingRoleIds}
        roleOptions={roleOptions}
        onRoleIdsChange={setEditingRoleIds}
        onChange={setEditingTemplate}
        onSave={handleSave}
        onCancel={() => {
          setEditingTemplate(null);
          setEditingRoleIds([]);
          router.replace("/forms/templates");
        }}
        pending={pending}
      />
    );
  }

  return (
    <div className="tpl-manager">
      <div className="tpl-manager__head">
        <div>
          <h2 className="tpl-manager__title">Form templates</h2>
          <p className="tpl-manager__desc">
            Build audit rubrics, assign them to roles, and control which users
            see each form.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNewEditor}>
            <Plus size={16} aria-hidden />
            Create template
          </Button>
        )}
      </div>

      <LoadingZone loading={pending} label="Updating templates…">
      <div className="tpl-manager__grid">
        {templates.map((tpl) => {
          const isActive = tpl.id === activeTemplateId;
          const sectionCount = tpl.sections.length;
          const paramCount = tpl.sections.reduce(
            (n, s) => n + s.params.length,
            0
          );

          return (
            <article
              key={tpl.id}
              className={cn("tpl-card", isActive && "tpl-card--active")}
            >
              <div className="tpl-card__top">
                <div
                  className={cn(
                    "tpl-card__icon",
                    isActive && "tpl-card__icon--active"
                  )}
                >
                  <Settings2 size={18} aria-hidden />
                </div>
                {tpl.isDefault && (
                  <span className="tpl-card__badge">System default</span>
                )}
              </div>

              <h3 className="tpl-card__name">{tpl.name}</h3>
              <p className="tpl-card__text">
                {tpl.description || "No description provided."}
              </p>

              <div className="tpl-card__tags">
                <span className="tpl-card__tag">{tpl.type}</span>
                <span className="tpl-card__tag">
                  {sectionCount} section{sectionCount === 1 ? "" : "s"}
                </span>
                <span className="tpl-card__tag">
                  {paramCount} param{paramCount === 1 ? "" : "s"}
                </span>
              </div>

              {!tpl.isDefault && tpl.roleNames.length > 0 && (
                <p className="tpl-card__roles">
                  Assigned: {tpl.roleNames.join(", ")}
                </p>
              )}
              {tpl.isDefault && (
                <p className="tpl-card__roles">Visible to all roles</p>
              )}

              <div className="tpl-card__actions">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="tpl-card__active-btn"
                  disabled={isActive || pending}
                  onClick={() => handleSetActive(tpl.id)}
                >
                  {isActive && <Check size={14} aria-hidden />}
                  {isActive ? "Currently active" : "Set active"}
                </Button>
                {canManage && (
                  <div className="tpl-card__icon-actions">
                    <button
                      type="button"
                      className="tpl-card__icon-btn"
                      title="Edit template"
                      onClick={() => openEditor(tpl)}
                    >
                      <Edit size={15} aria-hidden />
                    </button>
                    {!tpl.isDefault && (
                      <button
                        type="button"
                        className="tpl-card__icon-btn tpl-card__icon-btn--danger"
                        title="Delete template"
                        disabled={pending}
                        onClick={() => handleDelete(tpl.id)}
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      </LoadingZone>
    </div>
  );
}

function TemplateEditor({
  template,
  roleIds,
  roleOptions,
  onRoleIdsChange,
  onChange,
  onSave,
  onCancel,
  pending,
}: {
  template: AuditTemplate;
  roleIds: string[];
  roleOptions: RoleOption[];
  onRoleIdsChange: (ids: string[]) => void;
  onChange: (t: AuditTemplate) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const totalMax = useMemo(
    () =>
      template.sections
        .filter((s) => !s.isFatal)
        .flatMap((s) => s.params)
        .filter((p) => p.scoring !== "Y/N-CMM")
        .reduce((n, p) => n + p.max, 0),
    [template.sections]
  );

  const toggleRole = (roleId: string) => {
    onRoleIdsChange(
      roleIds.includes(roleId)
        ? roleIds.filter((id) => id !== roleId)
        : [...roleIds, roleId]
    );
  };

  const updateSection = (sectionId: string, patch: Partial<AuditSection>) => {
    onChange({
      ...template,
      sections: template.sections.map((s) =>
        s.id === sectionId ? { ...s, ...patch } : s
      ),
    });
  };

  const removeSection = (sectionId: string) => {
    onChange({
      ...template,
      sections: template.sections.filter((s) => s.id !== sectionId),
    });
  };

  const addSection = () => {
    onChange({
      ...template,
      sections: [
        ...template.sections,
        {
          id: `s-${Date.now()}`,
          name: "New Section",
          isFatal: false,
          params: [],
        },
      ],
    });
  };

  const addParam = (sectionId: string) => {
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const param: AuditParameter = {
      id: `p-${Date.now()}`,
      name: "New Parameter",
      max: 5,
      cat: section.name,
      scoring: "Y/N/NA",
      points: { Y: 5, N: 0 },
    };

    updateSection(sectionId, { params: [...section.params, param] });
  };

  const updateParam = (
    sectionId: string,
    paramIndex: number,
    patch: Partial<AuditParameter>
  ) => {
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const params = section.params.map((p, i) =>
      i === paramIndex ? { ...p, ...patch, cat: section.name } : p
    );
    updateSection(sectionId, { params });
  };

  const removeParam = (sectionId: string, paramIndex: number) => {
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      params: section.params.filter((_, i) => i !== paramIndex),
    });
  };

  return (
    <div className="tpl-editor">
      <div className="tpl-editor__toolbar">
        <button type="button" className="tpl-editor__back" onClick={onCancel}>
          <ArrowLeft size={16} aria-hidden />
          Back to templates
        </button>
        <Button size="sm" onClick={onSave} disabled={pending}>
          <Save size={16} aria-hidden />
          {pending ? "Saving…" : "Save template"}
        </Button>
      </div>

      <LoadingZone loading={pending} label="Saving template…">
      <div className="tpl-editor__meta">
        <div className="tpl-editor__meta-main">
          <Field>
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
            />
          </Field>
          <Field>
            <Label htmlFor="tpl-desc">Description</Label>
            <textarea
              id="tpl-desc"
              className="ui-input tpl-editor__textarea"
              rows={2}
              value={template.description ?? ""}
              onChange={(e) =>
                onChange({ ...template, description: e.target.value })
              }
              placeholder="Explain the purpose of this audit template…"
            />
          </Field>
        </div>
        <div className="tpl-editor__meta-side">
          <Field>
            <Label htmlFor="tpl-type">Type</Label>
            <Select
              id="tpl-type"
              value={template.type}
              onChange={(e) => onChange({ ...template, type: e.target.value })}
            >
              <option value="Call">Call</option>
              <option value="Chat">Chat</option>
              <option value="Call / Chat">Call / Chat</option>
              <option value="Email">Email</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="tpl-lob">LOB affiliation</Label>
            <Input
              id="tpl-lob"
              value={template.lob}
              onChange={(e) => onChange({ ...template, lob: e.target.value })}
              placeholder="e.g. Sales / Support"
            />
          </Field>
          <p className="tpl-editor__max-hint">
            Scoring max total: <strong>{totalMax}</strong> pts
          </p>
        </div>
      </div>

      {!template.isDefault && (
        <div className="tpl-editor__roles">
          <div>
            <h3 className="tpl-editor__roles-title">Assign to roles</h3>
            <p className="tpl-editor__roles-desc">
              Only users with the selected roles will see this form on their
              Forms page.
            </p>
          </div>
          <div className="tpl-editor__roles-grid">
            {roleOptions.map((role) => {
              const checked = roleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={cn(
                    "tpl-editor__role-chip",
                    checked && "tpl-editor__role-chip--checked"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span>{role.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="tpl-editor__sections">
        {template.sections.map((section) => (
          <section key={section.id} className="tpl-section">
            <header className="tpl-section__head">
              <Input
                className="tpl-section__name-input"
                value={section.name}
                onChange={(e) =>
                  updateSection(section.id, { name: e.target.value })
                }
              />
              <label className="tpl-section__fatal">
                <input
                  type="checkbox"
                  checked={section.isFatal}
                  onChange={(e) =>
                    updateSection(section.id, { isFatal: e.target.checked })
                  }
                />
                Fatal section
              </label>
              <button
                type="button"
                className="tpl-section__remove"
                onClick={() => removeSection(section.id)}
                aria-label="Remove section"
              >
                <X size={16} />
              </button>
            </header>

            <div className="tpl-section__body">
              {section.params.length === 0 ? (
                <p className="tpl-section__empty">
                  No parameters in this section.
                </p>
              ) : (
                section.params.map((param, paramIndex) => (
                  <div key={param.id} className="tpl-param">
                    <Input
                      className="tpl-param__name"
                      value={param.name}
                      onChange={(e) =>
                        updateParam(section.id, paramIndex, {
                          name: e.target.value,
                        })
                      }
                    />
                    <div className="tpl-param__controls">
                      <label className="tpl-param__max">
                        Max
                        <input
                          type="number"
                          min={0}
                          value={param.max}
                          onChange={(e) =>
                            updateParam(section.id, paramIndex, {
                              max: parseInt(e.target.value, 10) || 0,
                            })
                          }
                        />
                      </label>
                      <Select
                        value={param.scoring}
                        onChange={(e) =>
                          updateParam(section.id, paramIndex, {
                            scoring: e.target.value as ScoringScheme,
                          })
                        }
                      >
                        {SCORING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        className="tpl-param__remove"
                        onClick={() => removeParam(section.id, paramIndex)}
                        aria-label="Remove parameter"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addParam(section.id)}
              >
                <PlusCircle size={14} aria-hidden />
                Add parameter
              </Button>
            </div>
          </section>
        ))}

        <button type="button" className="tpl-editor__add-section" onClick={addSection}>
          <Plus size={20} aria-hidden />
          Add new section
        </button>
      </div>
      </LoadingZone>
    </div>
  );
}
