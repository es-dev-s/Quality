import type { Prisma } from "@prisma/client";

export function caseInsensitiveIn(
  values: string[]
): Prisma.StringFilter | undefined {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return undefined;
  return { in: unique, mode: "insensitive" };
}

export function caseInsensitiveEquals(
  value: string
): Prisma.StringFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return { equals: trimmed, mode: "insensitive" };
}
