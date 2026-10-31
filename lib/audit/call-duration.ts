/**
 * Interaction (call / chat) duration helpers.
 *
 * Storage: `AuditSubmission.callDurationSec` — whole seconds (Int, nullable for
 * legacy / imported rows). Form + display: `mm:ss` under an hour, otherwise
 * `hh:mm:ss`.
 */

/** Upper bound for a single interaction — 24 hours. */
export const CALL_DURATION_MAX_SECONDS = 24 * 60 * 60;

export const CALL_DURATION_FORMAT_HINT = "mm:ss or hh:mm:ss";

export const CALL_DURATION_INVALID_MESSAGE =
  "Enter a valid duration as mm:ss or hh:mm:ss (e.g. 04:35).";

export const CALL_DURATION_REQUIRED_MESSAGE = "Call duration is required.";

const STRICT_PATTERN = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})$/;

/**
 * Parse a user-entered duration (`m:ss`, `mm:ss`, `h:mm:ss`, `hh:mm:ss`).
 * Returns whole seconds, or null when empty / malformed / out of range.
 * Seconds must be 0–59; minutes must be 0–59 when hours are given.
 */
export function parseCallDuration(value: string | null | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = STRICT_PATTERN.exec(text);
  if (!match) return null;
  const hours = match[1] !== undefined ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds > 59) return null;
  if (match[1] !== undefined && minutes > 59) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total <= 0 || total > CALL_DURATION_MAX_SECONDS) return null;
  return total;
}

/**
 * Lenient parser for spreadsheet imports: accepts the strict formats plus a
 * bare number of seconds ("332"). Never throws; returns null when unusable.
 */
export function parseImportedCallDuration(
  value: string | null | undefined
): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const total = Number(text);
    return total > 0 && total <= CALL_DURATION_MAX_SECONDS ? total : null;
  }
  return parseCallDuration(text);
}

export function isValidCallDuration(value: string | null | undefined): boolean {
  return parseCallDuration(value) !== null;
}

/** Seconds → `mm:ss` (< 1h) or `hh:mm:ss`. Empty string for null/invalid. */
export function formatCallDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  const total = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Normalize a typed value to canonical display form; unchanged if invalid. */
export function normalizeCallDurationInput(value: string): string {
  const seconds = parseCallDuration(value);
  return seconds === null ? value.trim() : formatCallDuration(seconds);
}

/** Keep only digits and colons while typing (max `hh:mm:ss` length). */
export function sanitizeCallDurationInput(value: string): string {
  return value.replace(/[^\d:]/g, "").replace(/:{2,}/g, ":").slice(0, 9);
}

export const CALL_DURATION_LABEL = "Call Duration";

/** Call Duration applies to Call audits only (never shown / required for Chat). */
export function appliesCallDuration(type: string | null | undefined): boolean {
  return type === "Call";
}

/** Seconds to persist for an interaction — always null for non-Call audits. */
export function callDurationSecondsForType(
  type: string | null | undefined,
  value: string | null | undefined,
  parser: (value: string | null | undefined) => number | null = parseCallDuration
): number | null {
  return appliesCallDuration(type) ? parser(value) : null;
}

/** Display text for tables / exports — "" for Chat or missing values. */
export function formatCallDurationForType(
  type: string | null | undefined,
  seconds: number | null | undefined
): string {
  return appliesCallDuration(type) ? formatCallDuration(seconds) : "";
}
