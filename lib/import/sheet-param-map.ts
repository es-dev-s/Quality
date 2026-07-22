import type { AuditParameter, AuditTemplate, ScoresMap, AuditRow } from "@/lib/audit/types";

/** Headers that are metadata / aggregates — never mapped as score params. */
const IGNORED_FLAT_HEADERS = new Set(
  [
    "s.n",
    "sn",
    "calldate",
    "auditdate",
    "qualityauditor",
    "call/chat",
    "callchat",
    "agentname",
    "teamname",
    "lob",
    "sublob",
    "mobilenumber",
    "reasonforcall",
    "agentsresponse",
    "ovaallscore(withfatal)",
    "ovaallscore",
    "overallscore(withfatal)",
    "overallscore",
    "defect%",
    "defect",
    "doj",
    "aon",
    "aonbucket",
    "weekstatus",
    "feedbackfortheagent",
    "severity",
    "feedbackstatus",
    "feedbackdate",
    "calllength",
    "callcompliance",
    "calletiquette",
    "queryresolution",
    "disposition",
    "calldisposition",
    "sales$compliance",
    "salescompliance",
    "template",
    "auditid",
    "supervisor",
    "business type",
    "businesstype",
  ].map((value) => value.replace(/[\s_/-]+/g, "").toLowerCase())
);

/**
 * Sheet header (normalized) → template param name(s).
 * Combined sheet columns can fill multiple rubric params.
 */
const SHEET_PARAM_ALIASES: Record<string, string[]> = {
  preferredmode: ["Preferred language", "Preferred Mode (Chat/Call)"],
  empathyapologypoliteness: ["Empathy/Apology", "Politeness"],
  "empathy/apology/politeness": ["Empathy/Apology", "Politeness"],
  empathyapology: ["Empathy/Apology"],
  valuecreation: ["Sales Effort/Value Creation"],
  saleseffortvaluecreation: ["Sales Effort/Value Creation"],
  sharedsolutiondetailsonceagain: ["Summarization"],
  "responsetime<10s": ["Response Time", "Hold (<=1min 3x)"],
  responsetime: ["Response Time", "Hold (<=1min 3x)"],
  upsellpromotions: ["Upsell / Promotions"],
  "upsell/promotions": ["Upsell / Promotions"],
  voiceclaritytone: ["Voice Clarity/Tone", "Message Clarity"],
  "voiceclarity/tone": ["Voice Clarity/Tone", "Message Clarity"],
  grammarsentence: ["Grammar & Sentence"],
  "grammar&sentence": ["Grammar & Sentence"],
  rateofspeech: ["Rate of Speech"],
  preferredlanguage: ["Preferred language"],
  condescendingrudeabuse: ["Condescending/Rude/Abuse"],
  "condescending/rude/abuse": ["Condescending/Rude/Abuse"],
  disconnectline: ["Disconnect Line"],
  personalinfoviolation: ["Personal Info Violation"],
};

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "")
    .replace(/[\s_-]+/g, "")
    .replace(/[()/]/g, "");
}

function listTemplateParams(template: AuditTemplate): Array<{
  sectionName: string;
  param: AuditParameter;
}> {
  const out: Array<{ sectionName: string; param: AuditParameter }> = [];
  for (const section of template.sections) {
    for (const param of section.params) {
      out.push({ sectionName: section.name, param });
    }
  }
  return out;
}

function findParamByName(
  template: AuditTemplate,
  name: string
): { sectionName: string; param: AuditParameter } | null {
  const target = normalizeLookupKey(name);
  for (const entry of listTemplateParams(template)) {
    if (normalizeLookupKey(entry.param.name) === target) {
      return entry;
    }
  }
  return null;
}

/** Normalize Google Sheet score cells into stored score-map values. */
export function normalizeSheetScoreValue(
  raw: string,
  param: AuditParameter
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();
  if (upper === "N/A" || upper === "NA" || upper === "NULL") return "NA";
  if (upper === "FATAL" || upper === "F") return "Fatal";
  if (upper === "EE" || upper === "ME" || upper === "BE") return upper;

  if (upper === "Y" || upper === "YES" || upper === "TRUE" || upper === "1") {
    if (param.scoring === "Y/N-CMM") return "Y";
    if (param.scoring?.startsWith("EE/")) return "EE";
    return String(param.max);
  }

  if (upper === "N" || upper === "NO" || upper === "FALSE" || upper === "0") {
    if (param.scoring === "Y/N-CMM") return "N";
    if (param.scoring === "Y/Fatal/NA") return "Fatal";
    if (param.scoring?.startsWith("EE/")) return "BE";
    return "0";
  }

  // Values like "Y — 2" / "EE — 4"
  const labelMatch = trimmed.match(/^(Y|N|EE|ME|BE|FATAL|N\/A|NA)\b/i);
  if (labelMatch) {
    return normalizeSheetScoreValue(labelMatch[1], param);
  }

  return trimmed;
}

function resolveTargetParamNames(header: string): string[] {
  const key = normalizeLookupKey(header);
  if (IGNORED_FLAT_HEADERS.has(key)) return [];
  if (SHEET_PARAM_ALIASES[key]) return SHEET_PARAM_ALIASES[key];
  // Exact param-name header (Greeting, Permission, …)
  return [header.replace(/__\d+$/i, "").trim()];
}

function pickFirstValueForHeader(
  row: Record<string, string>,
  headerBase: string
): string {
  const target = normalizeLookupKey(headerBase);
  const keys = Object.keys(row)
    .filter((key) => normalizeLookupKey(key) === target)
    .sort((a, b) => {
      const aDup = /__\d+$/i.test(a) ? 1 : 0;
      const bDup = /__\d+$/i.test(b) ? 1 : 0;
      return aDup - bDup;
    });

  for (const key of keys) {
    if (row[key]?.trim()) return row[key].trim();
  }
  return "";
}

/**
 * Map flat Google Sheet parameter columns (Greeting, Permission, …)
 * onto the Call/Chat template score map. Category › Parameter columns
 * still take precedence when present (handled by the caller).
 */
export function buildScoresFromFlatParamColumns(
  row: Record<string, string>,
  template: AuditTemplate
): { scores: ScoresMap; auditRows: AuditRow[] } {
  const scores: ScoresMap = {};
  const auditRows: AuditRow[] = [];
  const filled = new Set<string>();

  for (const header of Object.keys(row)) {
    const targets = resolveTargetParamNames(header);
    if (targets.length === 0) continue;

    const cellValue = pickFirstValueForHeader(row, header);
    if (!cellValue) continue;

    for (const targetName of targets) {
      const matched = findParamByName(template, targetName);
      if (!matched || filled.has(matched.param.id)) continue;

      const sel = normalizeSheetScoreValue(cellValue, matched.param);
      if (!sel) continue;

      filled.add(matched.param.id);
      scores[matched.param.id] = sel;
      auditRows.push({
        id: matched.param.id,
        cat: matched.sectionName,
        name: matched.param.name,
        max: matched.param.max,
        sel,
        score: 0,
        fatal: /fatal/i.test(sel),
        isScoringFatal: /fatal/i.test(sel),
      });
    }
  }

  return { scores, auditRows };
}
