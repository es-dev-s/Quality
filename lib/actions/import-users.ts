"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  UserImportPayload,
  UserImportResult,
} from "@/lib/import/user-import-types";
import { requirePermission } from "@/lib/auth-guards";
import { IMPORT_ENABLED } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { prisma } from "@/lib/prisma";
import { buildPasswordCredentials } from "@/lib/password-credentials";

const importRowSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
  role: z.string().min(1),
});

const importOptionsSchema = z.object({
  updateExisting: z.boolean().optional(),
});

function normalizeRoleKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function importUsers(
  rows: UserImportPayload[],
  options: { updateExisting?: boolean } = {}
): Promise<UserImportResult | { error: string }> {
  if (!IMPORT_ENABLED) {
    return { error: "Import is not available." };
  }

  await requirePermission(PERMISSIONS.IMPORT_WRITE);

  const parsedOptions = importOptionsSchema.safeParse(options);
  if (!parsedOptions.success) {
    return { error: "Invalid import options." };
  }

  if (rows.length === 0) {
    return { error: "No users to import." };
  }

  if (rows.length > 500) {
    return { error: "Import up to 500 users at a time." };
  }

  const updateExisting = parsedOptions.data.updateExisting ?? false;
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, slug: true },
  });

  const roleByKey = new Map<string, string>();
  for (const role of roles) {
    roleByKey.set(normalizeRoleKey(role.slug), role.id);
    roleByKey.set(normalizeRoleKey(role.name), role.id);
  }

  const result: UserImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const parsedRow = importRowSchema.safeParse({
      ...rows[index],
      email: rows[index].email.trim().toLowerCase(),
      name: rows[index].name.trim(),
      role: rows[index].role.trim(),
      password: rows[index].password.trim(),
    });

    if (!parsedRow.success) {
      result.errors.push({
        row: rowNumber,
        email: rows[index].email || `Row ${rowNumber}`,
        message: parsedRow.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }

    const roleId = roleByKey.get(normalizeRoleKey(parsedRow.data.role));
    if (!roleId) {
      result.errors.push({
        row: rowNumber,
        email: parsedRow.data.email,
        message: `Unknown role "${parsedRow.data.role}". Use an existing role name or slug.`,
      });
      continue;
    }

    const email = parsedRow.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (!updateExisting) {
        result.skipped += 1;
        result.errors.push({
          row: rowNumber,
          email,
          message: "Email already exists (enable update existing to overwrite).",
        });
        continue;
      }

      try {
        const credentials = await buildPasswordCredentials(parsedRow.data.password);
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: parsedRow.data.name,
            roleId,
            password: credentials.password,
            passwordEncrypted: credentials.passwordEncrypted,
          },
        });
        result.updated += 1;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          email,
          message:
            error instanceof Error ? error.message : "Could not update user.",
        });
      }
      continue;
    }

    try {
      const credentials = await buildPasswordCredentials(parsedRow.data.password);
      await prisma.user.create({
        data: {
          name: parsedRow.data.name,
          email,
          password: credentials.password,
          passwordEncrypted: credentials.passwordEncrypted,
          roleId,
        },
      });
      result.created += 1;
    } catch (error) {
      if (isPrismaUniqueViolation(error, "email")) {
        result.skipped += 1;
        result.errors.push({
          row: rowNumber,
          email,
          message: "Email already exists.",
        });
      } else {
        result.errors.push({
          row: rowNumber,
          email,
          message:
            error instanceof Error ? error.message : "Could not create user.",
        });
      }
    }
  }

  if (result.created > 0 || result.updated > 0) {
    revalidatePath("/settings");
    revalidatePath("/import");
  }

  return result;
}
