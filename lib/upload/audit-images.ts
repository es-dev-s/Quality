import path from "path";
import { createRandomUUID } from "@/lib/random-id";

export const AUDIT_IMAGE_UPLOAD_DIR = "storage/uploads/audit-images";

export const AUDIT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const EXTENSION_FALLBACK = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export type AuditImageValidationResult =
  | { ok: true; extension: string }
  | { ok: false; error: string };

export function validateAuditImageFile(
  file: File
): AuditImageValidationResult {
  if (!file.size) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > AUDIT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be ${Math.floor(AUDIT_IMAGE_MAX_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }

  const mime = file.type.trim().toLowerCase();
  if (mime && ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ok: true,
      extension:
        EXTENSION_BY_MIME[mime] ?? (path.extname(file.name) || ".jpg"),
    };
  }

  const ext = path.extname(file.name).toLowerCase();
  if (EXTENSION_FALLBACK.has(ext)) {
    return { ok: true, extension: ext === ".jpeg" ? ".jpg" : ext };
  }

  return {
    ok: false,
    error: "Unsupported image format. Use JPG, PNG, WebP, or GIF.",
  };
}

export function buildAuditImageFilename(originalName: string, extension: string) {
  const safeBase = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const suffix = createRandomUUID().slice(0, 8);
  const base = safeBase || "image";
  return `${base}-${suffix}${extension}`;
}

export function auditImagePublicPath(filename: string) {
  return `/api/files/audit-images/${filename}`;
}

export function resolveAuditImageUploadPath(filename: string) {
  return path.join(process.cwd(), AUDIT_IMAGE_UPLOAD_DIR, filename);
}
