export function relatedNames(
  all: string[],
  byKey: Record<string, string[]>,
  selectedKey: string
): string[] {
  const trimmed = selectedKey.trim();
  if (!trimmed) return all;

  const exact = byKey[trimmed];
  if (exact) return exact;

  const match = Object.keys(byKey).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase()
  );
  return match ? byKey[match] : [];
}

export function withCurrentSelection(names: string[], current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed) return names;
  if (names.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
    return names;
  }
  return [...names, trimmed].sort((a, b) => a.localeCompare(b));
}

export function toSortedNameRecord(
  map: Map<string, Set<string>>
): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [key, values] of map) {
    record[key] = [...values].sort((a, b) => a.localeCompare(b));
  }
  return record;
}

export function reportPeopleSelectOptions(
  options: {
    agents: string[];
    supervisors: string[];
    agentsBySupervisor: Record<string, string[]>;
    supervisorsByAgent: Record<string, string[]>;
  },
  agent: string,
  supervisor: string
) {
  const agentNames = withCurrentSelection(
    relatedNames(options.agents, options.agentsBySupervisor, supervisor),
    agent
  );
  const supervisorNames = withCurrentSelection(
    relatedNames(options.supervisors, options.supervisorsByAgent, agent),
    supervisor
  );

  return {
    agents: [
      { value: "", label: "All agents" },
      ...agentNames.map((name) => ({ value: name, label: name })),
    ],
    supervisors: [
      { value: "", label: "All supervisors" },
      ...supervisorNames.map((name) => ({ value: name, label: name })),
    ],
  };
}

export function addRelatedName(
  map: Map<string, Set<string>>,
  key: string,
  value: string
) {
  const trimmedKey = key.trim();
  const trimmedValue = value.trim();
  if (!trimmedKey || !trimmedValue) return;
  const set = map.get(trimmedKey) ?? new Set<string>();
  set.add(trimmedValue);
  map.set(trimmedKey, set);
}
