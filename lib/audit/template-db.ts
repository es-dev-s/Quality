import { cache } from "react";
import type { FormTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BUILTIN_AUDIT_TEMPLATES } from "@/lib/audit/rubrics";
import { patchTemplateFatalYnParams } from "@/lib/audit/fatal-yn-params";
import { patchTemplateProbingPreferredModeSwap } from "@/lib/audit/probing-preferred-mode-swap";
import type { AuditSection, AuditTemplate } from "@/lib/audit/types";

function applyTemplateParamPatches(template: AuditTemplate): AuditTemplate {
  return patchTemplateProbingPreferredModeSwap(
    patchTemplateFatalYnParams(template)
  );
}

export function rowToAuditTemplate(row: FormTemplate): AuditTemplate {
  return applyTemplateParamPatches({
    id: row.id,
    name: row.name,
    type: row.type,
    lob: row.lob,
    description: row.description,
    isDefault: row.isDefault,
    sections: row.sections as AuditSection[],
  });
}

/** Load the rubric used by an existing audit — not gated by template role access. */
export async function fetchAuditTemplateForEdit(
  templateId: string | null | undefined,
  interactionType: string
): Promise<AuditTemplate | null> {
  await ensureDefaultTemplate();

  const fallbackId = interactionType === "Chat" ? "chat" : "call";
  const resolvedId = templateId?.trim() || fallbackId;

  let row = await prisma.formTemplate.findUnique({
    where: { id: resolvedId },
  });

  if (!row && resolvedId !== fallbackId) {
    row = await prisma.formTemplate.findUnique({
      where: { id: fallbackId },
    });
  }

  return row ? rowToAuditTemplate(row) : null;
}

/** Seeds built-in templates once — does not overwrite existing rows on every read. */
export const ensureDefaultTemplate = cache(async (): Promise<void> => {
  for (const template of BUILTIN_AUDIT_TEMPLATES) {
    const existing = await prisma.formTemplate.findUnique({
      where: { id: template.id },
    });

    if (!existing) {
      try {
        await prisma.formTemplate.create({
          data: {
            id: template.id,
            name: template.name,
            type: template.type,
            lob: template.lob,
            description: template.description ?? "",
            isDefault: true,
            sections: template.sections,
          },
        });
      } catch {
        // Concurrent first requests
      }
    }
  }
});
