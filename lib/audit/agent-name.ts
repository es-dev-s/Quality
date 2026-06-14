/** Canonical display name + stable case-insensitive key for uniqueness. */
export function normalizeAgentName(name: string): { name: string; nameKey: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return {
    name: trimmed,
    nameKey: trimmed.toLowerCase(),
  };
}
