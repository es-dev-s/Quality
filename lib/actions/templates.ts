"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-guards";
import { canManageSettings, canWriteAuditTemplates, hasScope, isSuperAdmin } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ensureDefaultTemplate,
  rowToAuditTemplate,
} from "@/lib/audit/template-db";
import type { AuditTemplate } from "@/lib/audit/types";
import type { SessionRole } from "@/lib/rbac";

export type TemplateListItem = AuditTemplate & {
  roleIds: string[];
  roleNames: string[];
};

export type RoleOption = {
  id: string;
  name: string;
  slug: string;
};

type TemplateRow = Awaited<ReturnType<typeof fetchTemplateRows>>[number];

function revalidateTemplatePaths() {
  revalidatePath("/forms");
  revalidatePath("/forms/templates");
  revalidatePath("/forms/audit");
}

const fetchTemplateRows = cache(async () => {
  await ensureDefaultTemplate();
  return prisma.formTemplate.findMany({
    include: {
      roles: {
        include: { role: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
});

function mapTemplateRow(row: TemplateRow): TemplateListItem {
  return {
    ...rowToAuditTemplate(row),
    roleIds: row.roles.map((r) => r.roleId),
    roleNames: row.roles.map((r) => r.role.name),
  };
}

function filterRowsForRole(rows: TemplateRow[], role: SessionRole) {
  if (isSuperAdmin(role)) return rows;
  if (!hasScope(role, PERMISSIONS.AUDIT_TEMPLATES_READ)) {
    return rows.filter((row) => row.isDefault);
  }
  return rows.filter(
    (row) =>
      row.isDefault || row.roles.some((r) => r.roleId === role.id)
  );
}

async function userCanAccessTemplate(
  templateId: string,
  role: SessionRole
): Promise<boolean> {
  if (isSuperAdmin(role)) return true;

  const row = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    include: { roles: { select: { roleId: true } } },
  });

  if (!row) return false;
  if (row.isDefault) return true;
  return row.roles.some((r) => r.roleId === role.id);
}

function resolveActiveTemplateId(
  rows: TemplateRow[],
  role: SessionRole,
  preferredId?: string | null
): string {
  const accessible = filterRowsForRole(rows, role);

  const normalizedPreferred =
    preferredId === "default" ? "call" : preferredId;

  if (normalizedPreferred) {
    const match = accessible.find((row) => row.id === normalizedPreferred);
    if (match) return match.id;
  }

  const callTemplate = accessible.find((row) => row.id === "call");
  if (callTemplate) return callTemplate.id;

  if (accessible.length > 0) return accessible[0].id;
  return "call";
}

async function syncTemplateRoles(templateId: string, roleIds: string[]) {
  const uniqueRoleIds = [...new Set(roleIds)];
  await prisma.$transaction(async (tx) => {
    await tx.roleFormTemplate.deleteMany({
      where: { templateId },
    });

    if (uniqueRoleIds.length === 0) return;

    await tx.roleFormTemplate.createMany({
      data: uniqueRoleIds.map((roleId) => ({ roleId, templateId })),
      skipDuplicates: true,
    });
  });
}

export async function getFormsPageData() {
  const session = await requirePermission(PERMISSIONS.AUDIT_FORM_READ);
  const rows = await fetchTemplateRows();
  const pref = await prisma.userTemplatePreference.findUnique({
    where: { userId: session.user.id },
    select: { activeTemplateId: true },
  });

  const templates = filterRowsForRole(rows, session.user.role).map(mapTemplateRow);

  return {
    templates,
    activeTemplateId: resolveActiveTemplateId(
      rows,
      session.user.role,
      pref?.activeTemplateId
    ),
    canManage: canWriteAuditTemplates(session.user.role),
  };
}

export async function getTemplatesManagerData() {
  const session = await requirePermission(PERMISSIONS.AUDIT_TEMPLATES_READ);
  const rows = await fetchTemplateRows();
  const pref = await prisma.userTemplatePreference.findUnique({
    where: { userId: session.user.id },
    select: { activeTemplateId: true },
  });

  const canManage = canWriteAuditTemplates(session.user.role);
  const templates = (canManage ? rows : filterRowsForRole(rows, session.user.role)).map(
    mapTemplateRow
  );

  const roleOptions = canManage
    ? await prisma.role.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];

  return {
    templates,
    activeTemplateId: resolveActiveTemplateId(
      rows,
      session.user.role,
      pref?.activeTemplateId
    ),
    canManage,
    roleOptions,
  };
}

export async function getAuditFormPageData(templateId: string) {
  const session = await requireAuth();
  const rows = await fetchTemplateRows();
  const accessible = filterRowsForRole(rows, session.user.role);
  const row = accessible.find((r) => r.id === templateId);
  if (!row) return null;

  return {
    template: rowToAuditTemplate(row),
    templates: accessible.map(mapTemplateRow),
  };
}

export async function getAuditFormRubrics() {
  await requireAuth();
  await ensureDefaultTemplate();

  const rows = await prisma.formTemplate.findMany({
    where: { id: { in: ["call", "chat"] } },
  });

  const callRow = rows.find((row) => row.id === "call");
  const chatRow = rows.find((row) => row.id === "chat");

  if (!callRow || !chatRow) return null;

  return {
    callTemplate: rowToAuditTemplate(callRow),
    chatTemplate: rowToAuditTemplate(chatRow),
  };
}

export async function getAuditFormWorkbench() {
  const session = await requireAuth();
  const rows = await fetchTemplateRows();
  const pref = await prisma.userTemplatePreference.findUnique({
    where: { userId: session.user.id },
    select: { activeTemplateId: true },
  });

  const templates = filterRowsForRole(rows, session.user.role).map(mapTemplateRow);
  const activeTemplateId = resolveActiveTemplateId(
    rows,
    session.user.role,
    pref?.activeTemplateId
  );

  return { templates, activeTemplateId };
}

export async function getTemplateRoleOptions(): Promise<RoleOption[]> {
  const session = await requireAuth();
  if (!canWriteAuditTemplates(session.user.role)) {
    return [];
  }

  return prisma.role.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

/** Templates visible on the Forms page for the current user's role. */
export async function listTemplates(): Promise<TemplateListItem[]> {
  const { templates } = await getFormsPageData();
  return templates;
}

/** All templates for the admin template manager. */
export async function listAllTemplates(): Promise<TemplateListItem[]> {
  const { templates } = await getTemplatesManagerData();
  return templates;
}

export async function getTemplateById(
  id: string
): Promise<AuditTemplate | null> {
  const session = await requireAuth();
  const canAccess = await userCanAccessTemplate(id, session.user.role);
  if (!canAccess) return null;

  const rows = await fetchTemplateRows();
  const row = rows.find((r) => r.id === id);
  return row ? rowToAuditTemplate(row) : null;
}

export async function getActiveTemplateId(): Promise<string> {
  const session = await requireAuth();
  const rows = await fetchTemplateRows();
  const pref = await prisma.userTemplatePreference.findUnique({
    where: { userId: session.user.id },
    select: { activeTemplateId: true },
  });

  return resolveActiveTemplateId(
    rows,
    session.user.role,
    pref?.activeTemplateId
  );
}

export async function getActiveTemplate(): Promise<AuditTemplate> {
  const id = await getActiveTemplateId();
  const template = await getTemplateById(id);
  if (!template) {
    throw new Error("Active template not found.");
  }
  return template;
}

/** Persist active template from the client — no revalidate (safe during navigation). */
export async function rememberActiveTemplate(templateId: string) {
  const session = await requireAuth();

  const canAccess = await userCanAccessTemplate(
    templateId,
    session.user.role
  );
  if (!canAccess) {
    return { error: "You do not have access to this template." };
  }

  await prisma.userTemplatePreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, activeTemplateId: templateId },
    update: { activeTemplateId: templateId },
  });

  return { success: true as const };
}

export async function setActiveTemplateId(templateId: string) {
  const result = await rememberActiveTemplate(templateId);
  if ("error" in result && result.error) {
    return result;
  }

  revalidateTemplatePaths();
  return { success: true as const, activeTemplateId: templateId };
}

export async function saveTemplate(
  template: AuditTemplate,
  roleIds: string[] = []
) {
  const session = await requireAuth();
  if (!canWriteAuditTemplates(session.user.role)) {
    return { error: "Not authorized to manage templates." };
  }

  if (!template.name.trim()) {
    return { error: "Template name is required." };
  }

  if (!template.isDefault && roleIds.length === 0) {
    return { error: "Assign at least one role to this template." };
  }

  await ensureDefaultTemplate();

  const existing = await prisma.formTemplate.findUnique({
    where: { id: template.id },
  });

  if (existing?.isDefault && template.isDefault === false) {
    return { error: "Cannot remove default flag from the system template." };
  }

  await prisma.formTemplate.upsert({
    where: { id: template.id },
    create: {
      id: template.id,
      name: template.name.trim(),
      type: template.type,
      lob: template.lob,
      description: template.description ?? "",
      isDefault: template.isDefault,
      sections: template.sections,
    },
    update: {
      name: template.name.trim(),
      type: template.type,
      lob: template.lob,
      description: template.description ?? "",
      sections: template.sections,
    },
  });

  if (!template.isDefault) {
    await syncTemplateRoles(template.id, roleIds);
  }

  revalidateTemplatePaths();
  return { success: true as const };
}

export async function deleteTemplate(templateId: string) {
  const session = await requireAuth();
  if (!canWriteAuditTemplates(session.user.role)) {
    return { error: "Not authorized to delete templates." };
  }

  if (templateId === "default") {
    return { error: "Cannot delete the default template." };
  }

  const row = await prisma.formTemplate.findUnique({
    where: { id: templateId },
  });
  if (!row) return { error: "Template not found." };
  if (row.isDefault) {
    return { error: "Cannot delete the default template." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.formTemplate.delete({ where: { id: templateId } });

    const prefs = await tx.userTemplatePreference.findMany({
      where: { activeTemplateId: templateId },
    });

    for (const pref of prefs) {
      await tx.userTemplatePreference.update({
        where: { userId: pref.userId },
        data: { activeTemplateId: "call" },
      });
    }
  });

  revalidateTemplatePaths();
  return { success: true as const };
}

export async function canManageTemplates(): Promise<boolean> {
  const session = await requireAuth();
  return canWriteAuditTemplates(session.user.role);
}
