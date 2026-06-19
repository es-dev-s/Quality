function bytesMatch(buffer: Buffer, offset: number, signature: number[]): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

export function validateImageMagicBytes(
  buffer: Buffer
): { ok: true } | { ok: false; error: string } {
  if (buffer.length < 12) {
    return { ok: false, error: "Invalid file format." };
  }

  // JPEG: FF D8 FF
  if (bytesMatch(buffer, 0, [0xff, 0xd8, 0xff])) {
    return { ok: true };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytesMatch(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true };
  }

  // WebP: RIFF....WEBP
  if (
    bytesMatch(buffer, 0, [0x52, 0x49, 0x46, 0x46]) &&
    bytesMatch(buffer, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { ok: true };
  }

  // GIF: GIF87a or GIF89a
  if (
    bytesMatch(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    bytesMatch(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { ok: true };
  }

  return { ok: false, error: "Invalid file format." };
}

export function validateAudioMagicBytes(
  buffer: Buffer
): { ok: true } | { ok: false; error: string } {
  if (buffer.length < 4) {
    return { ok: false, error: "Invalid audio format." };
  }

  // MP3 ID3
  if (bytesMatch(buffer, 0, [0x49, 0x44, 0x33])) {
    return { ok: true };
  }

  // MP3 frame sync: FF FB, FF F3, FF F2
  if (
    buffer[0] === 0xff &&
    (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2)
  ) {
    return { ok: true };
  }

  // WAV / other RIFF containers (WAV, WEBM uses different structure — WEBM is EBML)
  if (bytesMatch(buffer, 0, [0x52, 0x49, 0x46, 0x46])) {
    return { ok: true };
  }

  // OGG
  if (bytesMatch(buffer, 0, [0x4f, 0x67, 0x67, 0x53])) {
    return { ok: true };
  }

  // FLAC
  if (bytesMatch(buffer, 0, [0x66, 0x4c, 0x61, 0x43])) {
    return { ok: true };
  }

  // AAC ADTS
  if (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) {
    return { ok: true };
  }

  return { ok: false, error: "Invalid audio format." };
}
