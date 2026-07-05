import * as XLSX from "xlsx";
import { FEEDBACK_SEVERITY_LABEL } from "@/lib/audit/feedback";
import {
  parseFeedbackSecurity,
  parseFeedbackStatus,
} from "@/lib/audit/feedback";
import { calculateResults } from "@/lib/audit/calculate-results";
import type {
  AuditFormData,
  AuditRow,
  AuditTemplate,
  CategoryScore,
  InteractionType,
  ScoresMap,
} from "@/lib/audit/types";
import {
  parameterColumnKey,
} from "@/lib/reports/audit-export-row";
import type {
  AuditImportTemplateOption,
  ParsedAuditImportRow,
} from "@/lib/import/audit-import-types";
import { recordsFromSpreadsheet } from "@/lib/import/spreadsheet-records";
import { FIXED_EXPORT_HEADERS } from "@/lib/import/audit-export-headers";

const PARAM_CELL_RE =
  /^(.+?)\s*\(([\d.]+)\/([\d.]+)\)(?:\s*\[FATAL\])?$/i;
const PARAM_SUMMARY_SEGMENT_RE =
  /^([^|]+)\|([^|]+)\|([^|]+)\|([^|[]+)(?:\s*\[FATAL\])?$/;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function pickField(
  row: Record<string, string>,
  aliases: string[]
): string {
  for (const alias of aliases) {
    const key = Object.keys(row).find(
      (candidate) => normalizeHeader(candidate) === normalizeHeader(alias)
    );
    if (key && row[key]?.trim()) {
      return row[key].trim();
    }
  }
  return "";
}

function parseNumber(value: string, fallback = 0): number {
  const parsed = Number(String(value).replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function parseInteractionType(value: string): InteractionType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "chat") return "Chat";
  return "Call";
}

function splitList(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCategoryScoresColumn(value: string): Record<string, CategoryScore> {
  if (!value.trim()) return {};

  const result: Record<string, CategoryScore> = {};
  for (const segment of value.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?):\s*([\d.]+)\/([\d.]+)$/);
    if (!match) continue;
    result[match[1].trim()] = {
      scored: parseNumber(match[2]),
      max: parseNumber(match[3]),
    };
  }
  return result;
}

function parseParameterCell(value: string): {
  sel: string;
  score: number;
  max: number;
  fatal: boolean;
} | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(PARAM_CELL_RE);
  if (!match) {
    return {
      sel: trimmed,
      score: 0,
      max: 0,
      fatal: /\[FATAL\]/i.test(trimmed),
    };
  }

  return {
    sel: match[1].trim(),
    score: parseNumber(match[2]),
    max: parseNumber(match[3]),
    fatal: /\[FATAL\]/i.test(trimmed),
  };
}

function parseParameterSummary(value: string): AuditRow[] {
  if (!value.trim()) return [];

  const rows: AuditRow[] = [];

  for (const [index, segment] of value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .entries()) {
    const match = segment.match(PARAM_SUMMARY_SEGMENT_RE);
    if (!match) continue;

    const scoreParts = match[4].trim().split("/");
    const score = parseNumber(scoreParts[0] ?? "0");
    const max = parseNumber(scoreParts[1] ?? "0");
    const fatal = /\[FATAL\]/i.test(segment);

    rows.push({
      id: `import-${index + 1}`,
      cat: match[1].trim(),
      name: match[2].trim(),
      max,
      sel: match[3].trim(),
      score,
      fatal,
      isScoringFatal: fatal,
    });
  }

  return rows;
}

function isParameterHeader(header: string): boolean {
  return header.includes("›") || header.includes(">");
}

function normalizeParameterHeader(header: string): { cat: string; name: string } | null {
  const separator = header.includes("›") ? "›" : ">";
  const parts = header.split(separator);
  if (parts.length < 2) return null;
  return {
    cat: parts[0].trim(),
    name: parts.slice(1).join(separator).trim(),
  };
}

function findTemplateParam(
  template: AuditTemplate,
  cat: string,
  name: string
) {
  for (const section of template.sections) {
    if (section.name.trim().toLowerCase() !== cat.trim().toLowerCase()) {
      continue;
    }
    for (const param of section.params) {
      if (param.name.trim().toLowerCase() === name.trim().toLowerCase()) {
        return { section, param };
      }
    }
  }
  return null;
}

function resolveTemplate(
  templateName: string,
  interactionType: InteractionType,
  templates: AuditImportTemplateOption[]
): AuditImportTemplateOption | null {
  if (templateName.trim()) {
    const match = templates.find(
      (template) =>
        template.name.trim().toLowerCase() === templateName.trim().toLowerCase()
    );
    if (match) return match;
  }

  const fallbackId = interactionType === "Chat" ? "chat" : "call";
  return (
    templates.find((template) => template.id === fallbackId) ??
    templates.find(
      (template) => template.type.toLowerCase() === interactionType.toLowerCase()
    ) ??
    templates[0] ??
    null
  );
}

function buildScoresFromParameterColumns(
  row: Record<string, string>,
  template: AuditTemplate
): { scores: ScoresMap; auditRows: AuditRow[] } {
  const scores: ScoresMap = {};
  const auditRows: AuditRow[] = [];

  for (const [header, cellValue] of Object.entries(row)) {
    if (!isParameterHeader(header) || !cellValue.trim()) continue;

    const parsedHeader = normalizeParameterHeader(header);
    if (!parsedHeader) continue;

    const parsedCell = parseParameterCell(cellValue);
    if (!parsedCell) continue;

    const matched = findTemplateParam(
      template,
      parsedHeader.cat,
      parsedHeader.name
    );

    if (matched) {
      scores[matched.param.id] = parsedCell.sel;
      auditRows.push({
        id: matched.param.id,
        cat: matched.section.name,
        name: matched.param.name,
        max: matched.param.max,
        sel: parsedCell.sel,
        score: parsedCell.score,
        fatal: parsedCell.fatal,
        isScoringFatal: parsedCell.fatal,
      });
      continue;
    }

    auditRows.push({
      id: `import-${auditRows.length + 1}`,
      cat: parsedHeader.cat,
      name: parsedHeader.name,
      max: parsedCell.max,
      sel: parsedCell.sel,
      score: parsedCell.score,
      fatal: parsedCell.fatal,
      isScoringFatal: parsedCell.fatal,
    });
  }

  return { scores, auditRows };
}

function generateAuditCode(rowNumber: number, existing?: string): string {
  if (existing?.trim()) return existing.trim();
  return `AUD-IMPORT-${rowNumber}-${Date.now().toString(36).toUpperCase()}`;
}

function buildFormData(row: Record<string, string>): AuditFormData {
  const type = parseInteractionType(
    pickField(row, ["interaction type", "type", "interactiontype"])
  );

  return {
    agent: pickField(row, ["agent", "agent name"]),
    supervisor: pickField(row, ["supervisor", "supervisor name"]),
    auditor: pickField(row, [
      "quality analyst",
      "auditor",
      "quality analyst name",
    ]),
    type,
    businessType: pickField(row, ["business type", "businesstype"]),
    callDate: pickField(row, ["call date", "calldate", "interaction date"]),
    auditDate: pickField(row, ["audit date", "auditdate"]),
    lob: pickField(row, ["lob", "line of business"]),
    sublob: pickField(row, ["sub-lob", "sublob", "reason"]),
    mobile: pickField(row, [
      "contact (number / name)",
      "contact",
      "mobile",
      "phone",
    ]),
    referenceUrl: pickField(row, ["reference", "reference url", "referenceurl"]),
    reason: pickField(row, ["reason", "sub-reason"]),
    subReason: pickField(row, ["sub-reason (dff)", "sub-reason", "dff", "subreason"]),
    response: pickField(row, ["response"]),
    feedbackSecurity: parseFeedbackSecurity(
      pickField(row, [FEEDBACK_SEVERITY_LABEL, "severity", "feedback security"])
    ),
    feedbackStatus: parseFeedbackStatus(
      pickField(row, ["feedback status", "feedbackstatus"])
    ),
    feedbackDate: pickField(row, ["feedback date", "feedbackdate"]),
    agentFeedback: pickField(row, [
      "feedback for agent",
      "agent feedback",
      "agentfeedback",
    ]),
  };
}

export function parseAuditImportSpreadsheet(
  input: string | ArrayBuffer,
  kind: "csv" | "xlsx",
  templates: AuditImportTemplateOption[],
  templateBodies: Record<string, AuditTemplate> | Map<string, AuditTemplate>
): ParsedAuditImportRow[] {
  const templateBodyMap =
    templateBodies instanceof Map
      ? templateBodies
      : new Map(Object.entries(templateBodies));
  const records = recordsFromSpreadsheet(input, kind);
  if (records.length === 0) {
    throw new Error("No audit rows found in the file.");
  }

  return records.map((record, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];
    const formData = buildFormData(record);
    const auditCode = generateAuditCode(
      rowNumber,
      pickField(record, ["audit id", "audit code", "auditcode", "id"])
    );
    const templateName = pickField(record, ["template", "template name"]);
    const templateOption = resolveTemplate(
      templateName,
      formData.type,
      templates
    );

    if (!formData.agent.trim()) {
      errors.push("Agent is required.");
    }
    if (!formData.auditDate.trim() && !formData.callDate.trim()) {
      errors.push("Audit date or call date is required.");
    }

    const templateBody = templateOption
      ? templateBodyMap.get(templateOption.id) ?? null
      : null;

    let scores: ScoresMap = {};
    let auditRows = parseParameterSummary(
      pickField(record, ["parameter summary", "parameters"])
    );

    if (templateBody) {
      const fromColumns = buildScoresFromParameterColumns(record, templateBody);
      if (fromColumns.auditRows.length > 0) {
        scores = fromColumns.scores;
        auditRows = fromColumns.auditRows;
      }
    }

    const sheetQualityPct = parseNumber(
      pickField(record, ["quality %", "quality pct", "qualitypct"])
    );
    const sheetFinalPct = parseNumber(
      pickField(record, ["final %", "final pct", "finalpct"]),
      sheetQualityPct
    );
    const sheetHasFatal = parseBoolean(
      pickField(record, ["has fatal", "hasfatal"])
    );
    const sheetFatalList = splitList(
      pickField(record, ["fatal parameters", "fatallist", "fatal list"])
    );
    const sheetCatScores = parseCategoryScoresColumn(
      pickField(record, ["category scores", "categoryscores"])
    );
    const sheetTotalScored = parseNumber(
      pickField(record, ["points scored", "total scored", "totalscored"])
    );
    const sheetTotalMax = parseNumber(
      pickField(record, ["points max", "total max", "totalmax"])
    );
    const sheetGrade =
      pickField(record, ["grade"]) ||
      (sheetHasFatal ? "Failed" : "Needs Improvement");

    let qualityPct = sheetQualityPct;
    let finalPct = sheetHasFatal ? 0 : sheetFinalPct;
    let grade = sheetGrade;
    let hasFatal = sheetHasFatal;
    let fatalList = sheetFatalList;
    let totalScored = sheetTotalScored;
    let totalMax = sheetTotalMax;
    let catScores = sheetCatScores;

    if (templateBody && Object.keys(scores).length > 0) {
      const calculated = calculateResults(formData, scores, templateBody, {
        id: auditCode,
      });
      if (calculated.ok) {
        qualityPct = calculated.record.qualityPct;
        finalPct = calculated.record.finalPct;
        grade = calculated.record.grade;
        hasFatal = calculated.record.hasFatal;
        fatalList = calculated.record.fatalList;
        totalScored = calculated.record.totalScored;
        totalMax = calculated.record.totalMax;
        catScores = calculated.record.catScores;
        auditRows = calculated.record.rows;
      }
    }

    if (
      auditRows.length === 0 &&
      totalMax === 0 &&
      qualityPct === 0 &&
      !pickField(record, ["grade"]).trim()
    ) {
      errors.push(
        "Add parameter columns, a parameter summary, or quality scores."
      );
    }

    if (!templateOption) {
      errors.push("Could not match an audit template for this row.");
    }

    return {
      rowNumber,
      auditCode,
      templateName,
      templateId: templateOption?.id ?? null,
      formData,
      scores,
      auditRows,
      qualityPct,
      finalPct,
      grade,
      hasFatal,
      fatalList,
      totalScored,
      totalMax,
      catScores,
      feedback: {
        feedbackSecurity: formData.feedbackSecurity,
        feedbackStatus: formData.feedbackStatus,
        feedbackDate: formData.feedbackDate,
        feedbackStatusAt: pickField(record, [
          "acknowledged / disputed at",
          "feedback status at",
          "feedbackstatusat",
        ]),
        agentFeedback: formData.agentFeedback,
        supervisorRemarks: pickField(record, [
          "supervisor remarks",
          "supervisorremarks",
        ]),
      },
      submittedAt: pickField(record, ["submitted at", "submittedat", "created at"]),
      errors,
    };
  });
}

export function buildAuditImportTemplateCsv(): string {
  const headers = [...FIXED_EXPORT_HEADERS];
  return [
    headers.join(","),
    [
      "AUD-SAMPLE-001",
      "Call Quality",
      "Sample Agent",
      "Sample Supervisor",
      "Sample Analyst",
      "Call",
      "Sales",
      "Inbound Sales",
      "Billing",
      "Wrong Info",
      "Account issue",
      "2026-01-15",
      "2026-01-16",
      "9876543210",
      "https://crm.example/ticket/1",
      "Customer inquiry",
      "92",
      "92",
      "Excellent",
      "No",
      "",
      "46",
      "50",
      "Opening: 10/10; Compliance: 36/40",
      "Opening | Greeting | Y | 10/10; Compliance | Disclosure | Y | 36/40",
      "NA",
      "Pending",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(","),
  ].join("\n");
}

export { parameterColumnKey };

export function buildAuditImportTemplateXlsx(): Blob {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [...FIXED_EXPORT_HEADERS],
    [
      "AUD-SAMPLE-001",
      "Call Quality",
      "Sample Agent",
      "Sample Supervisor",
      "Sample Analyst",
      "Call",
      "Sales",
      "Inbound Sales",
      "Billing",
      "Wrong Info",
      "Account issue",
      "2026-01-15",
      "2026-01-16",
      "9876543210",
      "https://crm.example/ticket/1",
      "Customer inquiry",
      92,
      92,
      "Excellent",
      "No",
      "",
      46,
      50,
      "Opening: 10/10; Compliance: 36/40",
      "Opening | Greeting | Y | 10/10; Compliance | Disclosure | Y | 36/40",
      "NA",
      "Pending",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Audits");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
