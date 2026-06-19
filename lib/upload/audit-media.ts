import path from "path";
import { createRandomUUID } from "@/lib/random-id";

export const AUDIT_MEDIA_UPLOAD_DIR = "storage/uploads/audit-media";

export const AUDIT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac",
};

const EXTENSION_FALLBACK = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".webm",
  ".ogg",
  ".flac",
]);

export type AuditMediaValidationResult =
  | { ok: true; extension: string }
  | { ok: false; error: string };

export function validateAuditMediaFile(
  file: File
): AuditMediaValidationResult {
  if (!file.size) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > AUDIT_MEDIA_MAX_BYTES) {
    return {
      ok: false,
      error: `Audio file must be ${Math.floor(AUDIT_MEDIA_MAX_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }

  const mime = file.type.trim().toLowerCase();
  if (mime && ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ok: true,
      extension:
        EXTENSION_BY_MIME[mime] ?? (path.extname(file.name) || ".mp3"),
    };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (EXTENSION_FALLBACK.has(ext)) {
    return { ok: true, extension: ext };
  }

  return {
    ok: false,
    error: "Unsupported audio format. Use MP3, WAV, M4A, AAC, WebM, OGG, or FLAC.",
  };
}

export function buildAuditMediaFilename(originalName: string, extension: string) {
  const safeBase = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix = createRandomUUID().slice(0, 8);
  const base = safeBase || "recording";
  return `${base}-${suffix}${extension}`;
}

export function auditMediaPublicPath(filename: string) {
  return `/api/files/audit-media/${filename}`;
}

export function resolveAuditMediaUploadPath(filename: string) {
  return path.join(process.cwd(), AUDIT_MEDIA_UPLOAD_DIR, filename);
}
