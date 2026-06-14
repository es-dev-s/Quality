import fs from "fs";
import path from "path";

/** One-time agent roster — source of truth: agent.md at repo root. */
export const AGENT_ROSTER_FILE = "agent.md";

export type AgentRosterEntry = {
  name: string;
  dateOfJoining: string;
};

export type RosterDuplicate = {
  row: number;
  firstRow: number;
  name: string;
  dateOfJoining: string;
};

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Parse M/D/YYYY and DD-Mon-YY date strings to ISO YYYY-MM-DD. */
export function parseRosterDate(raw: string): string {
  const trimmed = raw.trim();

  const monMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/i);
  if (monMatch) {
    const day = monMatch[1].padStart(2, "0");
    const month = MONTH_MAP[monMatch[2].toLowerCase()];
    if (!month) throw new Error(`Unknown month in date: ${raw}`);
    const yy = parseInt(monMatch[3], 10);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${year}-${month}-${day}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    return `${slashMatch[3]}-${month}-${day}`;
  }

  throw new Error(`Unparseable date: ${raw}`);
}

export function toDisplayName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseLine(line: string): { name: string; dateRaw: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tabIndex = trimmed.indexOf("\t");
  if (tabIndex !== -1) {
    return {
      name: trimmed.slice(0, tabIndex).trim(),
      dateRaw: trimmed.slice(tabIndex + 1).trim(),
    };
  }

  const match = trimmed.match(/^(.+?)\s+(\d{1,2}[\/-].+)$/);
  if (!match) return null;

  return {
    name: match[1].trim(),
    dateRaw: match[2].trim(),
  };
}

type ParseOptions = {
  reportDuplicates?: boolean;
  /** 1-based row number offset for duplicate reporting (e.g. 2 if row 1 is header) */
  rowOffset?: number;
};

/** Parse roster lines, dedupe by case-insensitive name (first occurrence wins). */
export function parseAgentRosterLines(
  lines: string[],
  options: ParseOptions = {}
): {
  roster: AgentRosterEntry[];
  duplicates: RosterDuplicate[];
  skipped: string[];
} {
  const rowOffset = options.rowOffset ?? 1;
  const seen = new Map<string, { entry: AgentRosterEntry; row: number }>();
  const duplicates: RosterDuplicate[] = [];
  const skipped: string[] = [];

  lines.forEach((line, index) => {
    const rowNum = index + rowOffset;
    const parsed = parseLine(line);
    if (!parsed) {
      if (line.trim()) skipped.push(`Row ${rowNum}: ${line}`);
      return;
    }

    const displayName = toDisplayName(parsed.name);
    if (!displayName) {
      skipped.push(`Row ${rowNum}: empty name`);
      return;
    }

    let dateOfJoining: string;
    try {
      dateOfJoining = parseRosterDate(parsed.dateRaw);
    } catch {
      skipped.push(`Row ${rowNum}: bad date "${parsed.dateRaw}" for ${displayName}`);
      return;
    }

    const key = displayName.toLowerCase();
    const entry = { name: displayName, dateOfJoining };

    if (seen.has(key)) {
      const first = seen.get(key)!;
      duplicates.push({
        row: rowNum,
        firstRow: first.row,
        name: displayName,
        dateOfJoining,
      });
      return;
    }

    seen.set(key, { entry, row: rowNum });
  });

  const roster = Array.from(seen.values())
    .map((item) => item.entry)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { roster, duplicates, skipped };
}

export function parseAgentRosterFromFile(
  filePath = path.join(process.cwd(), AGENT_ROSTER_FILE)
): AgentRosterEntry[] {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const hasHeader =
    first.includes("name") && first.includes("date");

  const dataLines = hasHeader ? lines.slice(1) : lines;
  return parseAgentRosterLines(dataLines, { rowOffset: hasHeader ? 2 : 1 })
    .roster;
}

/** @deprecated Use parseAgentRosterFromFile() — reads agent.md directly. */
export function parseAgentRoster(): AgentRosterEntry[] {
  return parseAgentRosterFromFile();
}
