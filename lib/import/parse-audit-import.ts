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
import { recordsFromSpreadsheetWithMeta } from "@/lib/import/spreadsheet-records";
import { FIXED_EXPORT_HEADERS } from "@/lib/import/audit-export-headers";
import { buildScoresFromFlatParamColumns } from "@/lib/import/sheet-param-map";
import {
  buildAuditSheetPreviewStrict,
  hasTooManyEmptyImportColumns,
} from "@/lib/import/audit-sheet-columns";
import {
  entityErrorsForRow,
  type ImportEntityCatalog,
} from "@/lib/import/import-entity-catalog";
import { isBlankAuditSheetRow } from "@/lib/import/import-row-guards";

const PARAM_CELL_RE =
  /^(.+?)\s*\(([\d.]+)\/([\d.]+)\)(?:\s*\[FATAL\])?$/i;
const PARAM_SUMMARY_SEGMENT_RE =
  /^([^|]+)\|([^|]+)\|([^|]+)\|([^|[]+)(?:\s*\[FATAL\])?$/;

function normalizeHeader(value: string): string {
  return value
    .replace(/\r\n|\n|\r/g, " ")
    .trim()
    .toLowerCase()
    .replace(/__\d+$/i, "")
    .replace(/[\s_-]+/g, "")
    .replace(/[()/<%.>]+/g, "");
}

function findHeaderKeys(
  row: Record<string, string>,
  alias: string
): string[] {
  const target = normalizeHeader(alias);
  return Object.keys(row)
    .filter((candidate) => normalizeHeader(candidate) === target)
    .sort((a, b) => {
      const aDup = /__\d+$/i.test(a) ? 1 : 0;
      const bDup = /__\d+$/i.test(b) ? 1 : 0;
      return aDup - bDup;
    });
}

function pickField(
  row: Record<string, string>,
  aliases: string[]
): string {
  for (const alias of aliases) {
    for (const key of findHeaderKeys(row, alias)) {
      if (row[key]?.trim()) {
        return row[key].trim();
      }
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
  if (normalized.includes("chat")) return "Chat";
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
    pickField(row, [
      "call/chat",
      "call chat",
      "interaction type",
      "type",
      "interactiontype",
    ])
  );

  const teamName = pickField(row, ["team name", "teamname", "team"]);

  return {
    agent: pickField(row, ["agent name", "agent", "agentname"]),
    // Analytics "Team name" filters use the supervisor field.
    supervisor:
      teamName ||
      pickField(row, ["supervisor", "supervisor name"]),
    auditor: pickField(row, [
      "quality auditor",
      "quality analyst",
      "auditor",
      "quality analyst name",
      "qa",
    ]),
    type,
    businessType: pickField(row, ["business type", "businesstype"]),
    callDate: pickField(row, ["call date", "calldate", "interaction date"]),
    auditDate: pickField(row, ["audit date", "auditdate"]),
    lob: pickField(row, ["lob", "line of business"]),
    sublob: pickField(row, ["sub-lob", "sublob", "sub lob"]),
    mobile: pickField(row, [
      "mobile number",
      "mobilenumber",
      "contact (number / name)",
      "contact",
      "mobile",
      "phone",
    ]),
    referenceUrl: pickField(row, ["reference", "reference url", "referenceurl"]),
    reason: pickField(row, [
      "reason for call",
      "reasonforcall",
      "reason",
      "sub-reason",
    ]),
    subReason: pickField(row, [
      "sub-reason (dff)",
      "sub-reason",
      "dff",
      "subreason",
    ]),
    response: pickField(row, [
      "agent's response",
      "agents response",
      "agent response",
      "response",
    ]),
    feedbackSecurity: parseFeedbackSecurity(
      pickField(row, [FEEDBACK_SEVERITY_LABEL, "severity", "feedback security"])
    ),
    feedbackStatus: parseFeedbackStatus(
      pickField(row, ["feedback status", "feedbackstatus"])
    ),
    feedbackDate: pickField(row, ["feedback date", "feedbackdate"]),
    agentFeedback: pickField(row, [
      "feedback for the agent",
      "feedback for agent",
      "agent feedback",
      "agentfeedback",
    ]),
  };
}

export type ParseAuditImportOptions = {
  entityCatalog?: ImportEntityCatalog;
};

export function parseAuditImportSpreadsheet(
  input: string | ArrayBuffer,
  kind: "csv" | "xlsx",
  templates: AuditImportTemplateOption[],
  templateBodies: Record<string, AuditTemplate> | Map<string, AuditTemplate>,
  options: ParseAuditImportOptions = {}
): ParsedAuditImportRow[] {
  const templateBodyMap =
    templateBodies instanceof Map
      ? templateBodies
      : new Map(Object.entries(templateBodies));
  const { records: rawRecords } = recordsFromSpreadsheetWithMeta(input, kind);
  if (rawRecords.length === 0) {
    throw new Error("No audit rows found in the file.");
  }

  // Ensure contract column names exist on every row (name match + position fallback).
  // Blank rows and rows with >5 empty core columns are dropped — never shown or imported.
  const records = rawRecords
    .map((raw, index) => {
      const preview = buildAuditSheetPreviewStrict(raw);
      const enriched: Record<string, string> = { ...raw };
      for (const [column, value] of Object.entries(preview)) {
        if (value) {
          enriched[column] = value;
        }
      }
      return { raw, enriched, preview, sheetRowNumber: index + 1 };
    })
    .filter(
      ({ raw, enriched, preview }) =>
        !isBlankAuditSheetRow(raw) &&
        !isBlankAuditSheetRow(enriched) &&
        !hasTooManyEmptyImportColumns(preview)
    );

  if (records.length === 0) {
    throw new Error(
      "No audit rows found in the file (empty or incomplete rows with more than 5 empty core columns were ignored)."
    );
  }

  return records.map(({ enriched: record, preview, sheetRowNumber }) => {
    const rowNumber = sheetRowNumber;
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
      errors.push("Agent Name is required.");
    }
    if (!formData.auditor.trim()) {
      errors.push("Quality Auditor is required.");
    }
    if (!formData.auditDate.trim() && !formData.callDate.trim()) {
      errors.push("Audit date or call date is required.");
    }

    if (options.entityCatalog) {
      for (const message of entityErrorsForRow(
        {
          agent: formData.agent,
          auditor: formData.auditor,
        },
        options.entityCatalog
      )) {
        if (message.includes("not found")) {
          errors.push(message);
        }
      }
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
      } else {
        const fromFlat = buildScoresFromFlatParamColumns(record, templateBody);
        if (fromFlat.auditRows.length > 0) {
          scores = fromFlat.scores;
          auditRows = fromFlat.auditRows;
        }
      }
    }

    const sheetQualityRaw = pickField(record, [
      "overall score (with fatal)",
      "ova_all_score (with fatal)",
      "ova all score (with fatal)",
      "ova_all_score",
      "ova all score",
      "quality %",
      "quality pct",
      "qualitypct",
    ]);
    const sheetFinalRaw = pickField(record, [
      "final %",
      "final pct",
      "finalpct",
    ]);
    const sheetGradeRaw = pickField(record, ["grade"]);
    const sheetQualityPct = sheetQualityRaw ? parseNumber(sheetQualityRaw) : 0;
    const sheetFinalPct = sheetFinalRaw
      ? parseNumber(sheetFinalRaw)
      : sheetQualityRaw
        ? sheetQualityPct
        : 0;
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

    let qualityPct = sheetQualityPct;
    let finalPct = sheetHasFatal ? 0 : sheetFinalPct;
    let grade = sheetGradeRaw;
    let hasFatal = sheetHasFatal;
    let fatalList = sheetFatalList;
    let totalScored = sheetTotalScored;
    let totalMax = sheetTotalMax;
    let catScores = sheetCatScores;
    let calculatedFromTemplate = false;

    if (templateBody && Object.keys(scores).length > 0) {
      const calculated = calculateResults(formData, scores, templateBody, {
        id: auditCode,
      });
      if (calculated.ok) {
        calculatedFromTemplate = true;
        qualityPct = calculated.record.qualityPct;
        finalPct = calculated.record.finalPct;
        grade = calculated.record.grade;
        hasFatal = calculated.record.hasFatal;
        fatalList = calculated.record.fatalList;
        totalScored = calculated.record.totalScored;
        totalMax = calculated.record.totalMax;
        catScores = calculated.record.catScores;
        auditRows = calculated.record.rows;
      } else if (!sheetQualityRaw.trim() && sheetTotalMax === 0) {
        // Mapped params but neither calculator nor sheet aggregates can score it.
        errors.push(
          calculated.error ||
            "Could not calculate scores from the mapped parameters."
        );
      }
    }

    const hasMappedScores = Object.keys(scores).some(
      (key) => String(scores[key] ?? "").trim().length > 0
    );
    const hasAuditRowValues = auditRows.some((entry) => entry.sel.trim());
    const hasSheetScore = Boolean(sheetQualityRaw.trim());

    if (!hasMappedScores && !hasAuditRowValues && !hasSheetScore && totalMax === 0) {
      errors.push(
        "Missing scoring data — add parameter columns, a parameter summary, or an overall score."
      );
    }

    // Never invent a grade for incomplete rows (that used to create fake DB data).
    if (!grade.trim()) {
      if (hasFatal) {
        grade = "Failed";
      } else if (calculatedFromTemplate || hasSheetScore || totalMax > 0) {
        grade = "Needs Improvement";
      } else {
        errors.push("Grade is required when overall score is missing.");
      }
    }

    if (
      (hasSheetScore || calculatedFromTemplate) &&
      (!Number.isFinite(qualityPct) || qualityPct < 0 || qualityPct > 100)
    ) {
      errors.push("Overall score must be a number between 0 and 100.");
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
      submittedAt: pickField(record, [
        "submitted at",
        "submittedat",
        "created at",
      ]),
      sheetPreview: preview,
      errors: [...new Set(errors)],
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
