import * as XLSX from "xlsx";
import {
  AUDIT_SHEET_PREVIEW_COLUMNS,
  normalizeSheetHeader,
} from "@/lib/import/audit-sheet-columns";
import { isBlankAuditSheetRow } from "@/lib/import/import-row-guards";

export type SpreadsheetParseMeta = {
  delimiter: string;
  headerRowIndex: number;
  headers: string[];
};

/**
 * Parse full CSV/TSV text into rows, respecting quoted fields
 * (including newlines inside quotes from Google Sheets exports).
 */
export function parseCsvMatrix(
  text: string,
  delimiter = ","
): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cleanCell(current));
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cleanCell(current));
      current = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(cleanCell(current));
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function cleanCell(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, " ")
    .replace(/\r\n|\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Flatten multiline / messy spreadsheet headers into a single line. */
export function cleanHeaderLabel(header: string): string {
  return cleanCell(header);
}

/** Keep duplicate sheet headers addressable (Greeting, Greeting__2, …). */
export function uniquifyHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = cleanHeaderLabel(header) || `Column${index + 1}`;
    const key = normalizeSheetHeader(base) || `col${index + 1}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count === 1 ? base : `${base}__${count}`;
  });
}

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) count += 1;
  }
  return count;
}

/** Prefer the delimiter that produces the most columns on the first content line. */
export function detectCsvDelimiter(text: string): "," | ";" | "\t" {
  const source = text.replace(/^\uFEFF/, "");
  let sample = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      sample += char;
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) break;
    sample += char;
  }

  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let best: "," | ";" | "\t" = ",";
  let bestCount = -1;
  for (const delimiter of candidates) {
    const count = countDelimiterOutsideQuotes(sample, delimiter);
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

function scoreHeaderRow(cells: string[]): number {
  const norms = new Set(
    cells.map((cell) => normalizeSheetHeader(cell)).filter(Boolean)
  );
  let score = 0;
  for (const column of AUDIT_SHEET_PREVIEW_COLUMNS) {
    if (norms.has(normalizeSheetHeader(column))) score += 1;
  }
  // Bonus when serial column is present (common Google Sheet layout).
  if (norms.has("sn") || norms.has("sno") || norms.has("serial")) {
    score += 0.5;
  }
  return score;
}

/** Pick the row most likely to be the real header (skip title rows). */
export function findHeaderRowIndex(matrix: string[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 15);
  for (let index = 0; index < limit; index += 1) {
    const score = scoreHeaderRow(matrix[index] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function matrixToRecords(
  matrix: string[][],
  headerRowIndex: number
): { records: Record<string, string>[]; headers: string[] } {
  const headerCells = matrix[headerRowIndex] ?? [];
  const headers = uniquifyHeaders(headerCells);
  const records = matrix
    .slice(headerRowIndex + 1)
    .map((values) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cleanCell(String(values[index] ?? ""));
      });
      return record;
    })
    .filter((record) => !isBlankAuditSheetRow(record));

  return { records, headers };
}

export function recordsFromCsvText(text: string): Record<string, string>[] {
  return recordsFromCsvTextWithMeta(text).records;
}

export function recordsFromCsvTextWithMeta(text: string): {
  records: Record<string, string>[];
  meta: SpreadsheetParseMeta;
} {
  const delimiter = detectCsvDelimiter(text);
  const matrix = parseCsvMatrix(text, delimiter);
  if (matrix.length < 2) {
    return {
      records: [],
      meta: { delimiter, headerRowIndex: 0, headers: [] },
    };
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const { records, headers } = matrixToRecords(matrix, headerRowIndex);
  return {
    records,
    meta: { delimiter, headerRowIndex, headers },
  };
}

export function recordsFromExcelBuffer(buffer: ArrayBuffer): Record<string, string>[] {
  return recordsFromExcelBufferWithMeta(buffer).records;
}

export function recordsFromExcelBufferWithMeta(buffer: ArrayBuffer): {
  records: Record<string, string>[];
  meta: SpreadsheetParseMeta;
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      records: [],
      meta: { delimiter: "xlsx", headerRowIndex: 0, headers: [] },
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils
    .sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    })
    .map((row) => row.map((cell) => cleanCell(String(cell ?? ""))));

  if (matrix.length < 2) {
    return {
      records: [],
      meta: { delimiter: "xlsx", headerRowIndex: 0, headers: [] },
    };
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const { records, headers } = matrixToRecords(matrix, headerRowIndex);
  return {
    records,
    meta: { delimiter: "xlsx", headerRowIndex, headers },
  };
}

export function recordsFromSpreadsheet(
  input: string | ArrayBuffer,
  kind: "csv" | "xlsx"
): Record<string, string>[] {
  if (kind === "xlsx") {
    return recordsFromExcelBuffer(input as ArrayBuffer);
  }
  return recordsFromCsvText(input as string);
}

export function recordsFromSpreadsheetWithMeta(
  input: string | ArrayBuffer,
  kind: "csv" | "xlsx"
): { records: Record<string, string>[]; meta: SpreadsheetParseMeta } {
  if (kind === "xlsx") {
    return recordsFromExcelBufferWithMeta(input as ArrayBuffer);
  }
  return recordsFromCsvTextWithMeta(input as string);
}
