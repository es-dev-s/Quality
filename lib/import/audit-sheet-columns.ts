/**
 * Exact Google Sheet / CSV columns used for Superadmin audit import preview.
 * Order matches the upload contract — preview UI renders these column-wise.
 */
export const AUDIT_SHEET_PREVIEW_COLUMNS = [
  "Call Date",
  "Audit Date",
  "Quality Auditor",
  "Call/Chat",
  "Agent Name",
  "Team Name",
  "LOB",
  "Sub-LOB",
  "Mobile Number",
  "Reason for Call",
  "Agent's Response",
  "Greeting",
  "Permission",
  "Closing",
  "Active Listening",
  "Empathy / Apology / Politeness",
  "Preferred Mode",
  "Voice Clarity / Tone",
  "Context Setting",
  "Professionalism",
  "Grammar & Sentence",
  "Rate of Speech",
  "Probing",
  "Correct Resolution",
  "Complete Resolution",
  "Value Creation",
  "Shared Solution Details Once Again",
  "Response Time (<10s)",
  "All Queries Tagged",
  "Correct Tagging",
  "Upsell / Promotions",
  "Condescending / Rude / Abuse",
  "Disconnect Line",
  "Personal Info Violation",
  "Call Compliance",
  "Call Etiquette",
  "Query Resolution",
  "Disposition",
  "Overall Score (With Fatal)",
  "Defect %",
  "DOJ",
  "AON",
  "AON Bucket",
  "Week Status",
  "Feedback for the Agent",
  "Severity",
  "Feedback Status",
  "Feedback Date",
  "Call Length",
] as const;

export type AuditSheetPreviewColumn =
  (typeof AUDIT_SHEET_PREVIEW_COLUMNS)[number];

export type AuditSheetPreviewValues = Record<AuditSheetPreviewColumn, string>;

/** Extra aliases when sheet headers differ slightly from the contract names. */
const COLUMN_ALIASES: Record<AuditSheetPreviewColumn, string[]> = {
  "Call Date": ["call date", "calldate"],
  "Audit Date": ["audit date", "auditdate"],
  "Quality Auditor": [
    "quality auditor",
    "quality analyst",
    "auditor",
    "qa",
  ],
  "Call/Chat": ["call/chat", "call chat", "interaction type", "type"],
  "Agent Name": ["agent name", "agent"],
  "Team Name": ["team name", "team", "supervisor"],
  LOB: ["lob", "line of business"],
  "Sub-LOB": ["sub-lob", "sublob", "sub lob"],
  "Mobile Number": ["mobile number", "mobile", "contact", "phone"],
  "Reason for Call": ["reason for call", "reason"],
  "Agent's Response": [
    "agent's response",
    "agents response",
    "agent response",
    "response",
  ],
  Greeting: ["greeting"],
  Permission: ["permission"],
  Closing: ["closing"],
  "Active Listening": ["active listening"],
  "Empathy / Apology / Politeness": [
    "empathy / apology / politeness",
    "empathy/apology/politeness",
    "empathy apology politeness",
  ],
  "Preferred Mode": ["preferred mode", "preferred language"],
  "Voice Clarity / Tone": [
    "voice clarity / tone",
    "voice clarity/tone",
    "voice clarity tone",
  ],
  "Context Setting": ["context setting"],
  Professionalism: ["professionalism"],
  "Grammar & Sentence": ["grammar & sentence", "grammar and sentence"],
  "Rate of Speech": ["rate of speech"],
  Probing: ["probing"],
  "Correct Resolution": ["correct resolution"],
  "Complete Resolution": ["complete resolution"],
  "Value Creation": ["value creation", "sales effort/value creation"],
  "Shared Solution Details Once Again": [
    "shared solution details once again",
    "summarization",
  ],
  "Response Time (<10s)": [
    "response time (<10s)",
    "response time",
    "response time <10s",
  ],
  "All Queries Tagged": ["all queries tagged"],
  "Correct Tagging": ["correct tagging"],
  "Upsell / Promotions": [
    "upsell / promotions",
    "upsell/promotions",
    "upsell promotions",
  ],
  "Condescending / Rude / Abuse": [
    "condescending / rude / abuse",
    "condescending/rude/abuse",
  ],
  "Disconnect Line": ["disconnect line"],
  "Personal Info Violation": ["personal info violation"],
  "Call Compliance": ["call compliance"],
  "Call Etiquette": ["call etiquette"],
  "Query Resolution": ["query resolution"],
  Disposition: ["disposition", "call disposition"],
  "Overall Score (With Fatal)": [
    "overall score (with fatal)",
    "ova_all_score (with fatal)",
    "ova all score (with fatal)",
    "ova_all_score",
    "quality %",
    "final %",
  ],
  "Defect %": ["defect %", "defect%", "defect"],
  DOJ: ["doj", "date of joining"],
  AON: ["aon"],
  "AON Bucket": ["aon bucket", "aonbucket"],
  "Week Status": ["week status", "weekstatus"],
  "Feedback for the Agent": [
    "feedback for the agent",
    "feedback for agent",
    "agent feedback",
  ],
  Severity: ["severity", "feedback security"],
  "Feedback Status": ["feedback status"],
  "Feedback Date": ["feedback date"],
  "Call Length": ["call length", "calllength"],
};

export function normalizeSheetHeader(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, " ")
    .replace(/\r\n|\n|\r/g, " ")
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "")
    .replace(/[\s_-]+/g, "")
    .replace(/[()/<%.>]+/g, "");
}

function isSerialHeader(header: string): boolean {
  const normalized = normalizeSheetHeader(header);
  return (
    normalized === "sn" ||
    normalized === "sno" ||
    normalized === "serial" ||
    normalized === "serialno" ||
    normalized === "serialnumber" ||
    normalized === "no"
  );
}

function countFilled(preview: AuditSheetPreviewValues): number {
  return AUDIT_SHEET_PREVIEW_COLUMNS.filter((column) =>
    Boolean(preview[column]?.trim())
  ).length;
}

/**
 * Identity / outcome columns used to detect incomplete junk rows.
 * Parameter score columns are excluded — Call vs Chat leaves many blank by design.
 */
export const AUDIT_IMPORT_SIGNAL_COLUMNS = [
  "Call Date",
  "Audit Date",
  "Quality Auditor",
  "Call/Chat",
  "Agent Name",
  "Team Name",
  "LOB",
  "Sub-LOB",
  "Overall Score (With Fatal)",
  "Feedback Status",
] as const satisfies readonly AuditSheetPreviewColumn[];

/** Rows with more than this many empty signal columns are hidden and not importable. */
export const MAX_EMPTY_IMPORT_SIGNAL_COLUMNS = 5;

/** True when a row is too incomplete to preview or import. */
export function hasTooManyEmptyImportColumns(
  preview: AuditSheetPreviewValues
): boolean {
  let empty = 0;
  for (const column of AUDIT_IMPORT_SIGNAL_COLUMNS) {
    if (!preview[column]?.trim()) empty += 1;
  }
  return empty > MAX_EMPTY_IMPORT_SIGNAL_COLUMNS;
}

function buildPreviewFromNames(
  row: Record<string, string>
): AuditSheetPreviewValues {
  const byNormalized = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeSheetHeader(key);
    if (!normalized) continue;
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, value.trim());
    } else if (!byNormalized.get(normalized) && value.trim()) {
      byNormalized.set(normalized, value.trim());
    }
  }

  const preview = {} as AuditSheetPreviewValues;
  for (const column of AUDIT_SHEET_PREVIEW_COLUMNS) {
    const aliases = [column, ...COLUMN_ALIASES[column]];
    let value = "";
    for (const alias of aliases) {
      const normalized = normalizeSheetHeader(alias);
      if (!normalized) continue;
      if (byNormalized.has(normalized)) {
        value = byNormalized.get(normalized) ?? "";
        if (value) break;
      }
    }
    preview[column] = value;
  }
  return preview;
}

/**
 * Fallback: map by column position using the user's exact header order.
 * Supports an optional leading S.N / serial column.
 */
function buildPreviewFromPositions(
  headers: string[],
  values: string[]
): AuditSheetPreviewValues {
  let offset = 0;
  if (headers[0] && isSerialHeader(headers[0])) {
    offset = 1;
  }

  // If sheet has exactly 49 data columns after optional serial, trust position.
  const available = values.length - offset;
  const preview = {} as AuditSheetPreviewValues;
  AUDIT_SHEET_PREVIEW_COLUMNS.forEach((column, index) => {
    preview[column] =
      available >= AUDIT_SHEET_PREVIEW_COLUMNS.length
        ? String(values[offset + index] ?? "").trim()
        : String(values[offset + index] ?? "").trim();
  });
  return preview;
}

/** Build column-wise preview values from a raw spreadsheet row. */
export function buildAuditSheetPreview(
  row: Record<string, string>
): AuditSheetPreviewValues {
  const headers = Object.keys(row);
  const values = Object.values(row);
  const named = buildPreviewFromNames(row);
  if (countFilled(named) >= 5) {
    return named;
  }

  // Name match failed (delimiter/header mismatch) — use exact column order.
  const positional = buildPreviewFromPositions(headers, values);
  if (countFilled(positional) > countFilled(named)) {
    return positional;
  }
  return named;
}

/** Merge named + positional so sparse named matches still fill remaining cells. */
export function buildAuditSheetPreviewStrict(
  row: Record<string, string>
): AuditSheetPreviewValues {
  const headers = Object.keys(row);
  const values = Object.values(row);
  const named = buildPreviewFromNames(row);
  const positional = buildPreviewFromPositions(headers, values);
  const merged = {} as AuditSheetPreviewValues;
  for (const column of AUDIT_SHEET_PREVIEW_COLUMNS) {
    merged[column] = named[column]?.trim() || positional[column]?.trim() || "";
  }
  return merged;
}
