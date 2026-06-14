"use client";

import { Field, Label, Select } from "@/components/primitives/field";
import type { TemplateListItem } from "@/lib/actions/templates";

type FormTemplateSelectProps = {
  templates: TemplateListItem[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
};

function templateOptionLabel(template: TemplateListItem) {
  const scoringMax = template.sections
    .filter((section) => !section.isFatal)
    .flatMap((section) => section.params)
    .filter((param) => param.scoring !== "Y/N-CMM")
    .reduce((sum, param) => sum + param.max, 0);

  return `${template.name} (${template.type})${scoringMax > 0 ? ` · ${scoringMax} pts` : ""}`;
}

export function FormTemplateSelect({
  templates,
  selectedId,
  disabled,
  onSelect,
}: FormTemplateSelectProps) {
  if (templates.length === 0) {
    return null;
  }

  return (
    <Field className="audit-form__toolbar-template">
      <Label htmlFor="audit-form-template" className="audit-form__template-label">
        Form template
      </Label>
      <Select
        id="audit-form-template"
        className="audit-form__template-select audit-control"
        value={selectedId}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
      >
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {templateOptionLabel(template)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
