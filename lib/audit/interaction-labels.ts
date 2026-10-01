import type { InteractionType } from "@/lib/audit/types";

export function interactionContactFieldLabel(type: InteractionType | string): string {
  return type === "Chat" ? "Number / name" : "Mobile number";
}

export function interactionContactPlaceholder(type: InteractionType | string): string {
  return type === "Chat"
    ? "e.g. guest name, ticket ID, or phone number"
    : "e.g. 916393540300";
}

export function interactionContactInputMode(
  type: InteractionType | string
): "text" | "tel" {
  return type === "Call" ? "tel" : "text";
}

export function interactionReferenceFieldLabel(
  type: InteractionType | string
): string {
  return type === "Chat" ? "Interaction reference" : "Call reference";
}

export function interactionReferenceSectionLabel(
  type: InteractionType | string,
  referenceKind: "url" | "image" | "audio" | "audit"
): string {
  if (referenceKind === "image") {
    return type === "Chat" ? "Chat screenshot" : "Reference image";
  }
  if (referenceKind === "audio") {
    return type === "Chat" ? "Chat recording" : "Call recording";
  }
  if (referenceKind === "audit") {
    return "Linked audit";
  }
  return type === "Chat" ? "Interaction reference" : "Reference URL";
}

export function interactionReferenceListLabel(
  type: InteractionType | string,
  referenceKinds: readonly ("url" | "image" | "audio" | "audit")[]
): string {
  const count = referenceKinds.length;
  if (count === 0) return interactionReferenceFieldLabel(type);
  if (new Set(referenceKinds).size === 1) {
    const base = interactionReferenceSectionLabel(type, referenceKinds[0]);
    return count > 1 ? `${base}s (${count})` : base;
  }
  return `${interactionReferenceFieldLabel(type)}s (${count})`;
}
