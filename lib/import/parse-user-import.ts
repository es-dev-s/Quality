import type { ParsedUserImportRow, UserImportPayload } from "@/lib/import/user-import-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function recordsFromCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });
    return record;
  });
}

function recordsFromJson(text: string): Record<string, string>[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { users?: unknown }).users)
      ? (parsed as { users: unknown[] }).users
      : null;

  if (!list) {
    throw new Error("JSON must be an array of users or { \"users\": [...] }.");
  }

  return list.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return {};
    }
    const row = entry as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
    );
  });
}

function toPayload(record: Record<string, string>): UserImportPayload {
  return {
    name: pickField(record, ["name", "full name", "full_name", "user name"]),
    email: pickField(record, ["email", "email address", "mail"]),
    password: pickField(record, ["password", "pass", "temporary password"]),
    role: pickField(record, [
      "role",
      "role name",
      "role slug",
      "role_name",
      "role_slug",
    ]),
  };
}

function validateRow(
  row: UserImportPayload,
  rowNumber: number,
  defaultPassword: string,
  requirePassword: boolean
): ParsedUserImportRow {
  const errors: string[] = [];
  const email = row.email.trim().toLowerCase();
  const password = row.password.trim() || defaultPassword.trim();

  if (!row.name.trim()) {
    errors.push("Name is required.");
  }
  if (!email) {
    errors.push("Email is required.");
  } else if (!EMAIL_RE.test(email)) {
    errors.push("Email format is invalid.");
  }
  if (!row.role.trim()) {
    errors.push("Role is required (use role name or slug).");
  }
  if (requirePassword && password.length < 6) {
    errors.push("Password must be at least 6 characters.");
  }

  return {
    rowNumber,
    name: row.name.trim(),
    email,
    password,
    role: row.role.trim(),
    errors,
  };
}

export function parseUserImportFile(
  text: string,
  format: "csv" | "json",
  options: {
    defaultPassword?: string;
    requirePassword?: boolean;
  } = {}
): ParsedUserImportRow[] {
  const defaultPassword = options.defaultPassword ?? "";
  const requirePassword = options.requirePassword ?? !defaultPassword;

  const records =
    format === "csv" ? recordsFromCsv(text) : recordsFromJson(text);

  if (records.length === 0) {
    throw new Error("No user rows found in the file.");
  }

  return records.map((record, index) =>
    validateRow(
      toPayload(record),
      index + 1,
      defaultPassword,
      requirePassword
    )
  );
}

export function buildUserImportTemplateCsv(): string {
  return [
    "name,email,password,role",
    "Jane Auditor,jane.auditor@example.com,ChangeMe123,Super Admin",
    "John Reviewer,john.reviewer@example.com,ChangeMe123,auditor",
  ].join("\n");
}
