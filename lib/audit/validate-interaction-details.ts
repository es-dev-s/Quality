import type { AuditFormData } from "@/lib/audit/types";

const BASE_REQUIRED_FIELDS: {
  key: keyof AuditFormData;
  label: string;
}[] = [
  { key: "agent", label: "Agent Name" },
  { key: "supervisor", label: "Supervisor Name" },
  { key: "callDate", label: "Call Date" },
  { key: "auditDate", label: "Audit Date" },
  { key: "auditor", label: "Quality Analyst" },
  { key: "lob", label: "LOB" },
  { key: "sublob", label: "Reason" },
  { key: "reason", label: "Sub-reason" },
  { key: "response", label: "Agent's Response" },
];

export function validateInteractionDetails(
  formData: AuditFormData
): string | null {
  for (const { key, label } of BASE_REQUIRED_FIELDS) {
    const value = formData[key];
    if (typeof value !== "string" || !value.trim()) {
      return `${label} is required.`;
    }
  }

  return null;
}

export function isInteractionDetailsComplete(formData: AuditFormData): boolean {
  return validateInteractionDetails(formData) === null;
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
