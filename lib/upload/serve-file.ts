import path from "path";

export function isSafeUploadFilename(filename: string): boolean {
  return /^[\w.-]+$/.test(filename);
}

export function resolveStorageFilePath(
  storageDir: string,
  filename: string
): string | null {
  const absoluteStorageDir = path.resolve(process.cwd(), storageDir);
  const resolved = path.resolve(absoluteStorageDir, filename);

  if (
    resolved !== absoluteStorageDir &&
    !resolved.startsWith(`${absoluteStorageDir}${path.sep}`)
  ) {
    return null;
  }

  return resolved;
}

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

export function contentTypeForImage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function contentTypeForMedia(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MEDIA_CONTENT_TYPES[ext] ?? "application/octet-stream";
}
