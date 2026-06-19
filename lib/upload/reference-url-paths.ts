export function isUploadedAudioPath(value: string) {
  return value.startsWith("/uploads/audit-media/");
}

export function isUploadedImagePath(value: string) {
  return value.startsWith("/uploads/audit-images/");
}

export function isUploadedReferencePath(value: string) {
  return isUploadedAudioPath(value) || isUploadedImagePath(value);
}

export function fileLabelFromUploadPath(path: string) {
  const name = path.split("/").pop() ?? "file";
  return name.replace(/^[a-zA-Z0-9._-]+-/, "").replace(/^\d+-/, "") || name;
}
