const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Client-side temporary password for admin forms (matches server charset). */
export function generateClientPassword(length = 12): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => PASSWORD_CHARS[byte % PASSWORD_CHARS.length]).join(
      ""
    );
  }

  return Array.from({ length }, () =>
    PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)]
  ).join("");
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}
