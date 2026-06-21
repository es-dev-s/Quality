/** Max upload sizes — shared by server validation and client pre-checks. */
export const AUDIT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AUDIT_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export const AUDIT_IMAGE_MAX_MB = Math.floor(
  AUDIT_IMAGE_MAX_BYTES / (1024 * 1024)
);
export const AUDIT_MEDIA_MAX_MB = Math.floor(
  AUDIT_MEDIA_MAX_BYTES / (1024 * 1024)
);
