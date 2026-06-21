import {
  AUDIT_IMAGE_MAX_BYTES,
  AUDIT_IMAGE_MAX_MB,
  AUDIT_MEDIA_MAX_BYTES,
  AUDIT_MEDIA_MAX_MB,
} from "@/lib/upload/limits";

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".webm",
  ".ogg",
  ".flac",
]);

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const AUDIO_MIMES = new Set([
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

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function validateClientImageFile(file: File): ValidationResult {
  if (!file.size) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > AUDIT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be ${AUDIT_IMAGE_MAX_MB} MB or smaller (${formatHint(file.size)} selected).`,
    };
  }
  const mime = file.type.trim().toLowerCase();
  const ext = fileExtension(file.name);
  if (
    (mime && IMAGE_MIMES.has(mime)) ||
    IMAGE_EXTENSIONS.has(ext) ||
    ext === ".jpeg"
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Unsupported image format. Use JPG, PNG, WebP, or GIF.",
  };
}

export function validateClientMediaFile(file: File): ValidationResult {
  if (!file.size) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > AUDIT_MEDIA_MAX_BYTES) {
    return {
      ok: false,
      error: `Audio must be ${AUDIT_MEDIA_MAX_MB} MB or smaller (${formatHint(file.size)} selected).`,
    };
  }
  const mime = file.type.trim().toLowerCase();
  const ext = fileExtension(file.name);
  if ((mime && AUDIO_MIMES.has(mime)) || AUDIO_EXTENSIONS.has(ext)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Unsupported audio format. Use MP3, WAV, M4A, AAC, WebM, OGG, or FLAC.",
  };
}

function formatHint(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
