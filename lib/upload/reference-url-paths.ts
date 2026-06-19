const LEGACY_IMAGE_PREFIX = "/uploads/audit-images/";

const LEGACY_AUDIO_PREFIX = "/uploads/audit-media/";

const API_IMAGE_PREFIX = "/api/files/audit-images/";

const API_AUDIO_PREFIX = "/api/files/audit-media/";

const AUDIT_REF_PREFIX = "audit-ref:";



export type ReferenceAttachmentKind = "url" | "image" | "audio" | "audit";



export function normalizeUploadedReferencePath(value: string): string {

  if (value.startsWith(LEGACY_IMAGE_PREFIX)) {

    return `${API_IMAGE_PREFIX}${value.slice(LEGACY_IMAGE_PREFIX.length)}`;

  }

  if (value.startsWith(LEGACY_AUDIO_PREFIX)) {

    return `${API_AUDIO_PREFIX}${value.slice(LEGACY_AUDIO_PREFIX.length)}`;

  }

  return value;

}



export function isUploadedAudioPath(value: string) {

  return (

    value.startsWith(API_AUDIO_PREFIX) || value.startsWith(LEGACY_AUDIO_PREFIX)

  );

}



export function isUploadedImagePath(value: string) {

  return (

    value.startsWith(API_IMAGE_PREFIX) || value.startsWith(LEGACY_IMAGE_PREFIX)

  );

}



export function isAuditReferencePath(value: string) {

  return value.startsWith(AUDIT_REF_PREFIX);

}



export function isUploadedReferencePath(value: string) {

  return (

    isUploadedAudioPath(value) ||

    isUploadedImagePath(value) ||

    isAuditReferencePath(value)

  );

}



export function buildAuditReferenceValue(auditCode: string) {

  return `${AUDIT_REF_PREFIX}${auditCode.trim()}`;

}



export function auditCodeFromReferencePath(value: string) {

  if (!isAuditReferencePath(value)) return null;

  return value.slice(AUDIT_REF_PREFIX.length).trim() || null;

}



export function detectReferenceAttachmentKind(value: string): ReferenceAttachmentKind {

  if (!value.trim()) return "url";

  if (isUploadedImagePath(value)) return "image";

  if (isUploadedAudioPath(value)) return "audio";

  if (isAuditReferencePath(value)) return "audit";

  return "url";

}



export function referenceAttachmentLabel(value: string): string {

  const kind = detectReferenceAttachmentKind(value);

  switch (kind) {

    case "image":

      return fileLabelFromUploadPath(value);

    case "audio":

      return fileLabelFromUploadPath(value);

    case "audit":

      return auditCodeFromReferencePath(value) ?? "Linked audit";

    default:

      return value.length > 48 ? `${value.slice(0, 45)}…` : value;

  }

}



export function fileLabelFromUploadPath(path: string) {

  const name = path.split("/").pop() ?? "file";

  return name.replace(/^[a-zA-Z0-9._-]+-/, "").replace(/^\d+-/, "") || name;

}

