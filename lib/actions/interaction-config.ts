"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { canManageSettings, canReadSettings } from "@/lib/rbac";
import { requirePermission } from "@/lib/auth-guards";
import { PERMISSIONS } from "@/lib/permissions";
import {
  sanitizeInteractionConfig,
  validateInteractionConfigStructure,
} from "@/lib/audit/interaction-config-normalize";
import {
  fetchInteractionConfigRow,
  rowToInteractionConfig,
} from "@/lib/audit/interaction-config-db";
import {
  enrichInteractionConfigWithRoleUsers,
  stripInteractionPeopleLists,
} from "@/lib/audit/interaction-config-people";
import { toIsoTimestamp } from "@/lib/db/to-iso-timestamp";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { assertWriteRateLimit } from "@/lib/server/rate-limit";
import { prisma } from "@/lib/prisma";
import type { InteractionConfig } from "@/lib/audit/types";

const stringListSchema = z.array(z.string().trim().min(1));

const lobConfigSchema = z.object({
  name: z.string().trim().min(1, "LOB name is required"),
  businessType: z.string().trim().min(1, "Business type is required"),
  sublobs: stringListSchema,
  subReasonsList: stringListSchema.optional(),
  dffList: stringListSchema.optional(),
  sublobReasons: z.record(z.string(), stringListSchema).optional(),
  sublobReasonSubReasons: z
    .record(z.string(), z.record(z.string(), stringListSchema))
    .optional(),
  reasonSubReasons: z.record(z.string(), stringListSchema).optional(),
  reasons: stringListSchema.optional(),
});

const interactionConfigSchema = z.object({
  agents: stringListSchema.optional(),
  supervisors: stringListSchema.optional(),
  auditors: stringListSchema.optional(),
  businessTypes: stringListSchema.min(
    1,
    "At least one business type is required"
  ),
  lobs: z.array(lobConfigSchema),
});

function revalidateInteractionPaths() {
  revalidateTag("interaction-config", "max");
  revalidatePath("/settings");
  revalidatePath("/forms/audit");
  revalidatePath("/forms");
  revalidatePath("/audit-logs");
}

export async function getInteractionConfig(): Promise<InteractionConfig> {
  await requireAuth();
  const row = await fetchInteractionConfigRow();
  const config = rowToInteractionConfig(row);
  return enrichInteractionConfigWithRoleUsers(config);
}

export async function getInteractionConfigManagerData() {
  const session = await requirePermission(PERMISSIONS.SETTINGS_READ);
  const row = await fetchInteractionConfigRow();
  const config = await enrichInteractionConfigWithRoleUsers(
    rowToInteractionConfig(row)
  );

  return {
    config,
    canManage: canManageSettings(session.user.role),
    updatedAt: toIsoTimestamp(row.updatedAt),
    configVersion: row.configVersion,
  };
}

export type SaveInteractionConfigResult =
  | { ok: true; updatedAt: string; configVersion: number }
  | { ok: false; error: string; conflict?: boolean };

export async function saveInteractionConfig(
  config: InteractionConfig,
  options?: { expectedVersion?: number | null }
): Promise<SaveInteractionConfigResult> {
  const session = await requireAuth();
  if (!canManageSettings(session.user.role)) {
    return {
      ok: false,
      error: "You do not have permission to edit interaction config.",
    };
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "interaction-config:save",
    { limit: 20, windowMs: 60_000 }
  );
  if (rateLimited) {
    return { ok: false, error: rateLimited.error };
  }

  const parsed = interactionConfigSchema.safeParse(config);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid interaction config.";
    return { ok: false, error: message };
  }

  const normalized = sanitizeInteractionConfig({
    ...parsed.data,
    agents: parsed.data.agents ?? [],
    supervisors: parsed.data.supervisors ?? [],
    auditors: parsed.data.auditors ?? [],
  });
  const configForStorage = stripInteractionPeopleLists(normalized);
  const structureError = validateInteractionConfigStructure(normalized);
  if (structureError) {
    return { ok: false, error: structureError.message };
  }

  try {
    const expectedVersion = options?.expectedVersion;

    const versionFilter =
      expectedVersion !== undefined && expectedVersion !== null
        ? { configVersion: expectedVersion }
        : {};

    const updated = await withDbRetry(() =>
      prisma.interactionConfig.updateMany({
        where: { id: "default", ...versionFilter },
        data: {
          config: configForStorage,
          configVersion: { increment: 1 },
        },
      })
    );

    if (updated.count === 1) {
      const saved = await withDbRetry(() =>
        prisma.interactionConfig.findUniqueOrThrow({
          where: { id: "default" },
          select: { updatedAt: true, configVersion: true },
        })
      );

      revalidateInteractionPaths();

      return {
        ok: true,
        updatedAt: toIsoTimestamp(saved.updatedAt),
        configVersion: saved.configVersion,
      };
    }

    const existing = await withDbRetry(() =>
      prisma.interactionConfig.findUnique({
        where: { id: "default" },
        select: { configVersion: true },
      })
    );

    if (!existing) {
      const created = await withDbRetry(() =>
        prisma.interactionConfig.create({
          data: {
            id: "default",
            config: configForStorage,
            configVersion: 1,
          },
          select: { updatedAt: true, configVersion: true },
        })
      );

      revalidateInteractionPaths();

      return {
        ok: true,
        updatedAt: toIsoTimestamp(created.updatedAt),
        configVersion: created.configVersion,
      };
    }

    return {
      ok: false,
      conflict: true,
      error:
        "Interaction config was updated elsewhere. Refreshing to load the latest version.",
    };
  } catch (error) {
    console.error("saveInteractionConfig failed:", error);
    return {
      ok: false,
      error: "Could not save interaction configuration. Please try again.",
    };
  }
}
