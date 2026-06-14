import {
  getLobDffOptions,
  getLobSubReasonOptions,
} from "@/lib/audit/lob-flat-lists";
import { isAllowedAuditor } from "@/lib/audit/auditors";
import type { AuditFormData, InteractionConfig } from "@/lib/audit/types";

type UserLike = { name: string | null; email: string };

function includesOption(options: string[], value: string): boolean {
  if (!value.trim()) return false;
  const key = value.toLowerCase();
  return options.some((option) => option.toLowerCase() === key);
}

export function validateAuditFormAgainstConfig(
  formData: AuditFormData,
  config: InteractionConfig,
  users: UserLike[] = []
): string | null {
  if (
    formData.businessType &&
    !config.businessTypes.some(
      (type) => type.toLowerCase() === formData.businessType.toLowerCase()
    )
  ) {
    return "Selected business type is no longer available. Refresh and try again.";
  }

  if (formData.agent && !includesOption(config.agents, formData.agent)) {
    return "Selected agent is not in the current interaction configuration.";
  }

  if (
    formData.supervisor &&
    !includesOption(config.supervisors, formData.supervisor)
  ) {
    return "Selected supervisor is not in the current interaction configuration.";
  }

  if (
    formData.auditor &&
    !isAllowedAuditor(formData.auditor, config, users)
  ) {
    return "Selected quality analyst is not assigned or no longer available.";
  }

  const matchedLob = config.lobs.find(
    (lob) =>
      lob.name === formData.lob && lob.businessType === formData.businessType
  );

  if (formData.lob && !matchedLob) {
    return "Selected LOB is not valid for this business type.";
  }

  if (matchedLob && formData.sublob) {
    if (!includesOption(matchedLob.sublobs, formData.sublob)) {
      return "Selected reason is not valid for this LOB.";
    }
  }

  if (matchedLob && formData.reason) {
    const subReasons = getLobSubReasonOptions(matchedLob);
    if (!includesOption(subReasons, formData.reason)) {
      return "Selected sub-reason is not valid for this LOB.";
    }
  }

  if (matchedLob && formData.subReason) {
    const dffOptions = getLobDffOptions(matchedLob);
    if (
      dffOptions.length > 0 &&
      !includesOption(dffOptions, formData.subReason)
    ) {
      return "Selected DFF is not valid for this LOB.";
    }
  }

  if (matchedLob) {
    const dffOptions = getLobDffOptions(matchedLob);
    if (dffOptions.length > 0 && !formData.subReason.trim()) {
      return "DFF is required.";
    }
  }

  return null;
}
