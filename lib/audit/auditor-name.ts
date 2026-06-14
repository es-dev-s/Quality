/** Match session display name to configured auditor list (case-insensitive). */
export function resolveAuditorNameForSession(
  currentName: string,
  auditors: string[]
): string {
  const trimmed = currentName.trim();
  if (!trimmed) return "";
  const match = auditors.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase()
  );
  return match ?? trimmed;
}
