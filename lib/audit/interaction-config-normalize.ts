import type { InteractionConfig, LOBConfig } from "@/lib/audit/types";
import { ensureLobFlatLists } from "@/lib/audit/lob-flat-lists";

function dedupeSortPreserveCase(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export function sanitizeLob(lob: LOBConfig): LOBConfig {
  const withFlat = ensureLobFlatLists(lob);
  const sublobs = dedupeSortPreserveCase(withFlat.sublobs);
  const subReasonsList = dedupeSortPreserveCase(withFlat.subReasonsList ?? []);
  const dffList = dedupeSortPreserveCase(withFlat.dffList ?? []);

  return {
    name: lob.name.trim(),
    businessType: lob.businessType.trim(),
    sublobs,
    subReasonsList,
    dffList,
    sublobReasons: {},
    sublobReasonSubReasons: undefined,
    reasonSubReasons: undefined,
    reasons: undefined,
  };
}

export function sanitizeInteractionConfig(
  config: InteractionConfig
): InteractionConfig {
  const businessTypes = dedupeSortPreserveCase(config.businessTypes);
  const resolvedBusinessTypes =
    businessTypes.length > 0 ? businessTypes : ["Sales", "Support"];

  return {
    agents: dedupeSortPreserveCase(config.agents),
    supervisors: dedupeSortPreserveCase(config.supervisors),
    auditors: dedupeSortPreserveCase(config.auditors),
    businessTypes: resolvedBusinessTypes,
    lobs: config.lobs
      .map(sanitizeLob)
      .filter((lob) => lob.name.length > 0)
      .map((lob) => ({
        ...lob,
        businessType: resolvedBusinessTypes.includes(lob.businessType)
          ? lob.businessType
          : resolvedBusinessTypes[0],
      })),
  };
}

export type InteractionConfigValidationError = {
  field: string;
  message: string;
};

export function validateInteractionConfigStructure(
  config: InteractionConfig
): InteractionConfigValidationError | null {
  if (config.businessTypes.length === 0) {
    return {
      field: "businessTypes",
      message: "At least one business type is required.",
    };
  }

  const businessTypeKeys = new Set(
    config.businessTypes.map((type) => type.toLowerCase())
  );
  if (businessTypeKeys.size !== config.businessTypes.length) {
    return {
      field: "businessTypes",
      message: "Business type names must be unique (case-insensitive).",
    };
  }

  const lobKeys = new Set<string>();
  for (const lob of config.lobs) {
    if (!config.businessTypes.includes(lob.businessType)) {
      return {
        field: "lobs",
        message: `LOB "${lob.name}" uses unknown business type "${lob.businessType}".`,
      };
    }
    const key = `${lob.businessType.toLowerCase()}::${lob.name.toLowerCase()}`;
    if (lobKeys.has(key)) {
      return {
        field: "lobs",
        message: `Duplicate LOB "${lob.name}" under ${lob.businessType}.`,
      };
    }
    lobKeys.add(key);
  }

  return null;
}
