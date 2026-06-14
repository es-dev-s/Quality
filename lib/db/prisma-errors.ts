import { Prisma } from "@prisma/client";

export function isPrismaUniqueViolation(
  error: unknown,
  field?: string
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  if (!field) return true;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes(field);
  }
  return String(target ?? "").includes(field);
}
