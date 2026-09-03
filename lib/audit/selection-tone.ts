export const SELECTION_TONES = [
  "ee",
  "me",
  "be",
  "y",
  "n",
  "fatal",
  "na",
  "neutral",
] as const;

export type SelectionTone = (typeof SELECTION_TONES)[number];

const EXACT_TONES: Record<string, SelectionTone> = {
  ee: "ee",
  me: "me",
  be: "be",
  y: "y",
  n: "n",
  yes: "y",
  no: "n",
  fatal: "fatal",
  na: "na",
  "n/a": "na",
};

/** Canonical tone for a stored or displayed selection (EE, ME, BE, Y, N, …). */
export function getSelectionTone(value: string): SelectionTone {
  const raw = value.trim();
  if (!raw) return "neutral";

  const key = raw.toLowerCase();
  if (EXACT_TONES[key]) return EXACT_TONES[key];

  const token = key.split(/[\s/—–-]+/)[0] ?? "";
  if (EXACT_TONES[token]) return EXACT_TONES[token];

  if (key.includes("non-compliance")) return "n";
  if (key.includes("compliance")) return "y";
  if (key.startsWith("fatal")) return "fatal";
  if (key === "0") return "n";

  return "neutral";
}

/** Shared fill class — apply to the whole cell, chip, or select trigger. */
export function selectionToneClass(value: string): string {
  return `sel-tone-${getSelectionTone(value)}`;
}
