const LEGACY_IMAGE_PREFIX = "/uploads/audit-images/";

const LEGACY_AUDIO_PREFIX = "/uploads/audit-media/";

const API_IMAGE_PREFIX = "/api/files/audit-images/";

const API_AUDIO_PREFIX = "/api/files/audit-media/";

const AUDIT_REF_PREFIX = "audit-ref:";



export type ReferenceAttachmentKind = "url" | "image" | "audio" | "audit";



/** Max references (URLs, uploads, linked audits) stored on one audit. */
export const MAX_REFERENCE_ITEMS = 10;



export const MAX_REFERENCE_ITEM_LENGTH = 2048;



/**
 * One audit can carry several references, stored newline-separated in the
 * single `reference_url` column. Legacy single-value rows parse as one item.
 */
export function parseReferenceList(value: string | null | undefined): string[] {

  if (!value) return [];

  const seen = new Set<string>();

  const items: string[] = [];

  for (const line of value.split(/\r?\n/)) {

    const item = line.trim();

    if (!item || seen.has(item)) continue;

    seen.add(item);

    items.push(item);

  }

  return items;

}



export function serializeReferenceList(items: readonly string[]): string {

  return parseReferenceList(items.join("\n")).join("\n");

}



export function normalizeReferenceValue(value: string | null | undefined): string {

  return serializeReferenceList(parseReferenceList(value));

}



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

