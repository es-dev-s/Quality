import type { AuditParameter, AuditSection, AuditTemplate } from "@/lib/audit/types";

function yn(
  id: string,
  name: string,
  max: number,
  cat: string
): AuditParameter {
  return {
    id,
    name,
    max,
    cat,
    scoring: "Y/N/NA",
    points: { Y: max, N: 0 },
  };
}

function eeme(
  id: string,
  name: string,
  max: number,
  me: number,
  cat: string
): AuditParameter {
  return {
    id,
    name,
    max,
    cat,
    scoring: "EE/ME/BE/NA",
    points: { EE: max, ME: me, BE: 0 },
  };
}

function cmm(id: string, name: string): AuditParameter {
  return {
    id,
    name,
    max: 0,
    cat: "CMM Compliance",
    scoring: "Y/N-CMM",
  };
}

const CMM_PARAMS: AuditParameter[] = [
  cmm("cmm-rude", "Condescending/Rude/Abuse"),
  cmm("cmm-disconnect", "Disconnect Line"),
  cmm("cmm-pii", "Personal Info Violation"),
  cmm("cmm-wrongtag", "Complaints tagged wrongly"),
  cmm("cmm-blind", "Blind Transfer"),
  cmm("cmm-escalation", "Escalation Denied"),
];

function cmmSection(prefix: string): AuditSection {
  return {
    id: `${prefix}-cmm`,
    name: "CMM Compliance",
    isFatal: false,
    params: CMM_PARAMS.map((param) => ({
      ...param,
      id: `${prefix}-${param.id}`,
    })),
  };
}

const CALL_SECTIONS: AuditSection[] = [
  {
    id: "call-compliance",
    name: "Call Compliance",
    isFatal: false,
    params: [
      yn("call-greeting", "Greeting", 2, "Call Compliance"),
      yn("call-permission", "Permission", 2, "Call Compliance"),
      yn("call-closing", "Closing", 2, "Call Compliance"),
      yn("call-hold", "Hold (<=1min 3x)", 3, "Call Compliance"),
      yn("call-followup", "Follow Up", 5, "Call Compliance"),
    ],
  },
  {
    id: "call-etiquette",
    name: "Call Etiquette",
    isFatal: false,
    params: [
      eeme("call-listening", "Active Listening", 4, 2, "Call Etiquette"),
      eeme("call-empathy", "Empathy/Apology", 4, 2, "Call Etiquette"),
      eeme("call-politeness", "Politeness", 4, 2, "Call Etiquette"),
      eeme("call-language", "Preferred language", 4, 2, "Call Etiquette"),
      eeme("call-clarity", "Voice Clarity/Tone", 4, 2, "Call Etiquette"),
      eeme("call-context", "Context Setting", 4, 2, "Call Etiquette"),
      eeme("call-grammar", "Grammar & Sentence", 4, 2, "Call Etiquette"),
      eeme("call-professionalism", "Professionalism", 4, 2, "Call Etiquette"),
      eeme("call-speech", "Rate of Speech", 4, 2, "Call Etiquette"),
    ],
  },
  {
    id: "call-resolution",
    name: "Query Resolution",
    isFatal: false,
    params: [
      yn("call-probing", "Probing", 4, "Query Resolution"),
      yn("call-correct", "Correct Resolution", 8, "Query Resolution"),
      yn("call-complete", "Complete Resolution", 5, "Query Resolution"),
      yn("call-summarization", "Summarization", 5, "Query Resolution"),
    ],
  },
  {
    id: "call-sales",
    name: "Sales $ Compliance",
    isFatal: false,
    params: [
      yn("call-upsell", "Upsell / Promotions", 3, "Sales $ Compliance"),
      yn("call-sales-effort", "Sales Effort/Value Creation", 10, "Sales $ Compliance"),
      yn("call-nurturing", "Client Nurturing", 5, "Sales $ Compliance"),
    ],
  },
  {
    id: "call-disposition",
    name: "Call Disposition",
    isFatal: false,
    params: [
      yn("call-alltagged", "All Queries Tagged", 5, "Call Disposition"),
      yn("call-correcttag", "Correct Tagging", 5, "Call Disposition"),
    ],
  },
  cmmSection("call"),
];

const CHAT_SECTIONS: AuditSection[] = [
  {
    id: "chat-compliance",
    name: "Call Compliance",
    isFatal: false,
    params: [
      yn("chat-greeting", "Greeting", 2, "Call Compliance"),
      yn("chat-closing", "Closing", 2, "Call Compliance"),
      yn("chat-response-time", "Response Time", 8, "Call Compliance"),
      yn("chat-followup", "Follow Up", 5, "Call Compliance"),
    ],
  },
  {
    id: "chat-etiquette",
    name: "Call Etiquette",
    isFatal: false,
    params: [
      eeme("chat-listening", "Active Listening", 4, 2, "Call Etiquette"),
      eeme("chat-empathy", "Empathy/Apology", 4, 2, "Call Etiquette"),
      eeme("chat-politeness", "Politeness", 4, 2, "Call Etiquette"),
      eeme("chat-grammar", "Grammar & Sentence", 5, 3, "Call Etiquette"),
      eeme("chat-professionalism", "Professionalism", 4, 2, "Call Etiquette"),
      eeme("chat-clarity", "Message Clarity", 4, 2, "Call Etiquette"),
      eeme("chat-context", "Context Setting", 4, 2, "Call Etiquette"),
      eeme("chat-preferred-mode", "Preferred Mode (Chat/Call)", 4, 2, "Call Etiquette"),
    ],
  },
  {
    id: "chat-resolution",
    name: "Query Resolution",
    isFatal: false,
    params: [
      yn("chat-probing", "Probing", 4, "Query Resolution"),
      yn("chat-correct", "Correct Resolution", 8, "Query Resolution"),
      yn("chat-complete", "Complete Resolution", 5, "Query Resolution"),
      yn("chat-summarization", "Summarization", 5, "Query Resolution"),
    ],
  },
  {
    id: "chat-sales",
    name: "Sales $ Compliance",
    isFatal: false,
    params: [
      yn("chat-upsell", "Upsell / Promotions", 3, "Sales $ Compliance"),
      yn("chat-sales-effort", "Sales Effort/Value Creation", 10, "Sales $ Compliance"),
      yn("chat-nurturing", "Client Nurturing", 5, "Sales $ Compliance"),
    ],
  },
  {
    id: "chat-disposition",
    name: "Call Disposition",
    isFatal: false,
    params: [
      yn("chat-alltagged", "All Queries Tagged", 5, "Call Disposition"),
      yn("chat-correcttag", "Correct Tagging", 5, "Call Disposition"),
    ],
  },
  cmmSection("chat"),
];

export const CALL_AUDIT_TEMPLATE: AuditTemplate = {
  id: "call",
  name: "Call Quality Audit",
  type: "Call",
  lob: "Sales / Support",
  description: "100-point call interaction rubric.",
  isDefault: true,
  sections: CALL_SECTIONS,
};

export const CHAT_AUDIT_TEMPLATE: AuditTemplate = {
  id: "chat",
  name: "Chat Quality Audit",
  type: "Chat",
  lob: "Sales / Support",
  description: "100-point chat interaction rubric.",
  isDefault: true,
  sections: CHAT_SECTIONS,
};

/** @deprecated Use CALL_AUDIT_TEMPLATE */
export const DEFAULT_TEMPLATE = CALL_AUDIT_TEMPLATE;

export const BUILTIN_AUDIT_TEMPLATES = [
  CALL_AUDIT_TEMPLATE,
  CHAT_AUDIT_TEMPLATE,
] as const;

export function scoringMaxForTemplate(template: AuditTemplate): number {
  return template.sections
    .filter((section) => !section.isFatal)
    .flatMap((section) => section.params)
    .filter((param) => param.scoring !== "Y/N-CMM")
    .reduce((sum, param) => sum + param.max, 0);
}
