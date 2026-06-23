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

const CALL_SOFT_FIELD_IDS = new Set([
  "lob",
  "sublob",
  "reason",
  "mobile",
  "referenceUrl",
  "response",
]);

export function getCallInteractionDefaultWarnings(
  formData: AuditFormData,
  subReasonCount: number
): { fieldIds: string[] } {
  const missing = findMissingInteractionFields(formData, subReasonCount).filter(
    (field) => CALL_SOFT_FIELD_IDS.has(field.id)
  );
  return {
    fieldIds: missing.map((f) => f.id),
  };
}
