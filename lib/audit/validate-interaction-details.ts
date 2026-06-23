import type { AuditFormData } from "@/lib/audit/types";

/** Interaction details are optional; auditors may score before metadata is complete. */
export function validateInteractionDetails(
  _formData: AuditFormData
): string | null {
  return null;
}

export function isInteractionDetailsComplete(_formData: AuditFormData): boolean {
  return true;
}

/** Split legacy combined mobile field (phone + URL in one) for edit forms. */
export function normalizeLegacyReferenceFields(
  mobile: string,
  referenceUrl: string | null | undefined
): { mobile: string; referenceUrl: string } {
  const ref = referenceUrl?.trim() ?? "";
  const phone = mobile?.trim() ?? "";

  if (ref) {
    return { mobile: phone, referenceUrl: ref };
  }

  if (
    /^https?:\/\//i.test(phone) ||
    phone.startsWith("/uploads/") ||
    phone.startsWith("uploads/")
  ) {
    return { mobile: "", referenceUrl: phone };
  }

  return { mobile: phone, referenceUrl: "" };
}
