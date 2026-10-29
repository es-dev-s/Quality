import {
  appliesCallDuration,
  isValidCallDuration,
} from "@/lib/audit/call-duration";
import type { AuditFormData } from "@/lib/audit/types";

export type InteractionFieldSpec = {
  id: string;
  label: string;
  isMissing: (formData: AuditFormData, subReasonCount: number) => boolean;
};

const INTERACTION_FIELD_SPECS: InteractionFieldSpec[] = [
  {
    id: "supervisor",
    label: "Supervisor",
    isMissing: (formData) => !formData.supervisor.trim(),
  },
  {
    id: "agent",
    label: "Agent",
    isMissing: (formData) => !formData.agent.trim(),
  },
  {
    id: "auditor",
    label: "Quality Analyst",
    isMissing: (formData) => !formData.auditor.trim(),
  },
  {
    id: "auditType",
    label: "Audit type",
    isMissing: (formData) => !formData.auditType.trim(),
  },
  {
    id: "callDate",
    label: "Interaction date",
    isMissing: (formData) => !formData.callDate.trim(),
  },
  {
    id: "businessType",
    label: "Business Type",
    isMissing: (formData) => !formData.businessType.trim(),
  },
  {
    id: "lob",
    label: "LOB",
    isMissing: (formData) => !formData.lob.trim(),
  },
  {
    id: "sublob",
    label: "Reason",
    isMissing: (formData) => !formData.sublob.trim(),
  },
  {
    id: "reason",
    label: "Sub-reason",
    isMissing: (formData, subReasonCount) =>
      subReasonCount > 0 ? !formData.reason.trim() : false,
  },
  {
    id: "mobile",
    label: "Number / name",
    isMissing: (formData) => !formData.mobile.trim(),
  },
  {
    id: "callDuration",
    label: "Call duration",
    // Call audits only. Missing or malformed (mm:ss / hh:mm:ss) blocks submit.
    isMissing: (formData) =>
      appliesCallDuration(formData.type) &&
      !isValidCallDuration(formData.callDuration ?? ""),
  },
  {
    id: "referenceUrl",
    label: "Interaction reference",
    isMissing: (formData) => !formData.referenceUrl.trim(),
  },
  {
    id: "response",
    label: "Agent's Response",
    isMissing: (formData) => !formData.response.trim(),
  },
];

export function findMissingInteractionFields(
  formData: AuditFormData,
  subReasonCount: number,
  options?: { skipReference?: boolean }
): InteractionFieldSpec[] {
  return INTERACTION_FIELD_SPECS.filter((field) => {
    if (options?.skipReference && field.id === "referenceUrl") {
      return false;
    }
    return field.isMissing(formData, subReasonCount);
  });
}

export function validateChatInteractionDetails(
  formData: AuditFormData,
  subReasonCount: number
): { ok: true } | { ok: false; fieldIds: string[] } {
  const missing = findMissingInteractionFields(formData, subReasonCount, {
    skipReference: true,
  });
  if (missing.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    fieldIds: missing.map((f) => f.id),
  };
}

export function validateCallInteractionDetails(
  formData: AuditFormData,
  subReasonCount: number
): { ok: true } | { ok: false; fieldIds: string[] } {
  const missing = findMissingInteractionFields(formData, subReasonCount);
  if (missing.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    fieldIds: missing.map((f) => f.id),
  };
}
