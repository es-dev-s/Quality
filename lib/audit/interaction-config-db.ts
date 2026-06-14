import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { InteractionConfig as PrismaInteractionConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BUSINESS_TYPES,
  DEFAULT_INTERACTION_CONFIG,
} from "@/lib/audit/seed-data";
import type { InteractionConfig, LOBConfig } from "@/lib/audit/types";
import { ensureLobFlatLists } from "@/lib/audit/lob-flat-lists";
import { getSystemMeta, setSystemMeta } from "@/lib/db/system-meta";
import { withDbRetry } from "@/lib/db/with-db-retry";

const META_INTERACTION_BACKFILL = "interaction_config_backfill_v1";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseNestedStringMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, items]) => Array.isArray(items))
      .map(([key, items]) => [key, parseStringArray(items)])
  );
}

function parseSublobReasonSubReasons(
  value: unknown
): Record<string, Record<string, string[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, reasons]) => reasons && typeof reasons === "object")
      .map(([sublob, reasons]) => [sublob, parseNestedStringMap(reasons)])
  );
}

function parseLobs(value: unknown, businessTypes: string[]): LOBConfig[] {
  if (!Array.isArray(value)) return [];
  const fallbackBusinessType = businessTypes[0] ?? "Sales";

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const lob = item as Record<string, unknown>;
      const sublobReasons =
        lob.sublobReasons && typeof lob.sublobReasons === "object"
          ? parseNestedStringMap(lob.sublobReasons)
          : {};

      const rawBusinessType =
        typeof lob.businessType === "string" ? lob.businessType : fallbackBusinessType;
      const businessType = businessTypes.includes(rawBusinessType)
        ? rawBusinessType
        : fallbackBusinessType;

      return ensureLobFlatLists({
        name: String(lob.name ?? ""),
        businessType,
        sublobs: parseStringArray(lob["sublobs"]),
        subReasonsList: parseStringArray(lob.subReasonsList),
        dffList: parseStringArray(lob.dffList),
        sublobReasons,
        sublobReasonSubReasons: parseSublobReasonSubReasons(
          lob.sublobReasonSubReasons
        ),
        reasonSubReasons: parseNestedStringMap(lob.reasonSubReasons),
        reasons: parseStringArray(lob.reasons),
      });
    })
    .filter((lob) => lob.name.length > 0);
}

export function rowToInteractionConfig(
  row: PrismaInteractionConfig
): InteractionConfig {
  const raw = row.config;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const config = raw as Record<string, unknown>;
    const businessTypes = parseStringArray(config.businessTypes);
    const resolvedBusinessTypes =
      businessTypes.length > 0 ? businessTypes : [...DEFAULT_BUSINESS_TYPES];

    return {
      agents: parseStringArray(config.agents),
      supervisors: parseStringArray(config.supervisors),
      auditors: parseStringArray(config.auditors),
      businessTypes: resolvedBusinessTypes,
      lobs: parseLobs(config.lobs, resolvedBusinessTypes),
    };
  }

  return DEFAULT_INTERACTION_CONFIG;
}

async function maybeBackfillInteractionConfig(
  row: PrismaInteractionConfig
): Promise<PrismaInteractionConfig> {
  if ((await getSystemMeta(META_INTERACTION_BACKFILL)) === "true") {
    return row;
  }

  const raw = row.config;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    await setSystemMeta(META_INTERACTION_BACKFILL, "true");
    return row;
  }

  const configRecord = raw as Record<string, unknown>;
  const needsBusinessTypes =
    parseStringArray(configRecord.businessTypes).length === 0;

  if (!needsBusinessTypes) {
    await setSystemMeta(META_INTERACTION_BACKFILL, "true");
    return row;
  }

  const merged = {
    ...configRecord,
    businessTypes: [...DEFAULT_BUSINESS_TYPES],
    agents: [],
    supervisors: [],
    auditors: [],
  };

  const updated = await withDbRetry(() =>
    prisma.interactionConfig.update({
      where: { id: "default" },
      data: { config: merged },
    })
  );

  await setSystemMeta(META_INTERACTION_BACKFILL, "true");
  return updated;
}

/** @deprecated Use fetchInteractionConfigRow — kept for scripts. */
export const ensureDefaultInteractionConfig = cache(async (): Promise<void> => {
  await fetchInteractionConfigRow();
});

export async function fetchInteractionConfigRow() {
  return getCachedInteractionConfigRow();
}

const getCachedInteractionConfigRow = unstable_cache(
  async () => fetchInteractionConfigRowUncached(),
  ["interaction-config-row"],
  { revalidate: 15, tags: ["interaction-config"] }
);

async function fetchInteractionConfigRowUncached() {
  let row = await withDbRetry(() =>
    prisma.interactionConfig.findUnique({
      where: { id: "default" },
    })
  );

  if (!row) {
    try {
      row = await withDbRetry(() =>
        prisma.interactionConfig.create({
          data: {
            id: "default",
            config: DEFAULT_INTERACTION_CONFIG,
          },
        })
      );
    } catch {
      row = await withDbRetry(() =>
        prisma.interactionConfig.findUnique({
          where: { id: "default" },
        })
      );
    }
  }

  if (!row) {
    return {
      id: "default",
      config: DEFAULT_INTERACTION_CONFIG,
      configVersion: 0,
      updatedAt: new Date(),
    };
  }

  return maybeBackfillInteractionConfig(row);
}
