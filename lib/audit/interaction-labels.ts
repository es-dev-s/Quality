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
