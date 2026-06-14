import type { AuditTemplate } from "@/lib/audit/types";

export function resolveAuditFormTemplateId(
  templates: Pick<AuditTemplate, "id">[],
  activeTemplateId: string,
  options?: { templateId?: string; interactionType?: "Call" | "Chat" }
): string {
  if (
    options?.templateId &&
    templates.some((template) => template.id === options.templateId)
  ) {
    return options.templateId;
  }

  if (
    options?.interactionType === "Chat" &&
    templates.some((template) => template.id === "chat")
  ) {
    return "chat";
  }

  if (
    options?.interactionType === "Call" &&
    templates.some((template) => template.id === "call")
  ) {
    return "call";
  }

  if (templates.some((template) => template.id === activeTemplateId)) {
    return activeTemplateId;
  }

  const callTemplate = templates.find((template) => template.id === "call");
  if (callTemplate) return callTemplate.id;

  return templates[0]?.id ?? "call";
}
