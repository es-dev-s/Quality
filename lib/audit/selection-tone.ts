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
  if (isBareNumber(key)) return "neutral";
  if (EXACT_TONES[key]) return EXACT_TONES[key];

  const token = key.split(/[\s/—–-]+/)[0] ?? "";
  if (isBareNumber(token)) return "neutral";
  if (EXACT_TONES[token]) return EXACT_TONES[token];

  if (key.includes("non-compliance")) return "n";
  if (key.includes("compliance")) return "y";
  if (key.startsWith("fatal")) return "fatal";

  return "neutral";
}

function isBareNumber(value: string) {
  return /^\d+(\.\d+)?$/.test(value);
}

/** Shared fill class — apply to the whole cell, chip, or select trigger. */
export function selectionToneClass(value: string): string {
  const tone = getSelectionTone(value);
  if (tone === "neutral") return "";
  return `sel-tone-${tone}`;
}
