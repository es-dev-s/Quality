/** Pure agent display-name matching (safe for client + server imports). */

export function normalizeAgentDisplayName(name: string): string {
  return name.trim().toLowerCase();
}

export function agentNameInVisibleSet(
  agentName: string,
  visibleNames: string[]
): boolean {
  const key = normalizeAgentDisplayName(agentName);
  return visibleNames.some(
    (visible) => normalizeAgentDisplayName(visible) === key
  );
}

export function filterAgentNamesToVisibleSet(
  agentNames: string[],
  visibleNames: string[]
): string[] {
  return agentNames.filter((name) => agentNameInVisibleSet(name, visibleNames));
}
