import type { AuditFormData } from "@/lib/audit/types";

const REQUIRED_FIELDS: {
  key: keyof AuditFormData;
  label: string;
}[] = [
  { key: "agent", label: "Agent Name" },
  { key: "supervisor", label: "Supervisor Name" },
  { key: "callDate", label: "Call Date" },
  { key: "auditDate", label: "Audit Date" },
  { key: "auditor", label: "Quality Auditor" },
  { key: "lob", label: "LOB" },
  { key: "sublob", label: "Reason" },
  { key: "mobile", label: "Mobile Number" },
  { key: "reason", label: "Sub-reason" },
  { key: "response", label: "Agent's Response" },
];

export type InteractionDetailsValidationContext = {
  subReasonRequired?: boolean;
};

export function validateInteractionDetails(
  formData: AuditFormData,
  context?: InteractionDetailsValidationContext
): string | null {
  for (const { key, label } of REQUIRED_FIELDS) {
    const value = formData[key];
    if (typeof value !== "string" || !value.trim()) {
      return `${label} is required.`;
    }
  }

  if (context?.subReasonRequired) {
    if (typeof formData.subReason !== "string" || !formData.subReason.trim()) {
      return "DFF is required.";
    }
  }

  return null;
}

export function isInteractionDetailsComplete(
  formData: AuditFormData,
  context?: InteractionDetailsValidationContext
): boolean {
  return validateInteractionDetails(formData, context) === null;
}
