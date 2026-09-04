"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { permissionError } from "@/lib/auth-guards";
import { canEditAuditTargets } from "@/lib/rbac";
import {
  readAuditTargets,
  writeAuditTargetPerAgent,
  writeAuditTargetTotalMonthly,
  type AuditTargets,
} from "@/lib/kpi/audit-targets";
import { assertWriteRateLimit } from "@/lib/server/rate-limit";

const perAgentSchema = z.object({
  value: z.number().int().min(1).max(999),
});

const totalMonthlySchema = z.object({
  value: z.number().int().min(1).max(99_999),
});

function revalidateTargetPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/kpi");
  revalidatePath("/analytics");
}

export async function getAuditTargets(): Promise<AuditTargets> {
  await requireAuth();
  return readAuditTargets();
}

export async function setAuditTargetPerAgent(value: number) {
  const session = await requireAuth();
  if (!canEditAuditTargets(session.user.role)) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "audit-target:per-agent",
    { limit: 30, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = perAgentSchema.safeParse({ value });
  if (!parsed.success) {
    return { error: "Enter a whole number between 1 and 999." };
  }

  const perAgent = await writeAuditTargetPerAgent(parsed.data.value);
  revalidateTargetPaths();
  return { success: true as const, perAgent };
}

export async function setAuditTargetTotalMonthly(value: number) {
  const session = await requireAuth();
  if (!canEditAuditTargets(session.user.role)) {
    return permissionError();
  }

  const rateLimited = assertWriteRateLimit(
    session.user.id,
    "audit-target:total-monthly",
    { limit: 30, windowMs: 60_000 }
  );
  if (rateLimited) return rateLimited;

  const parsed = totalMonthlySchema.safeParse({ value });
  if (!parsed.success) {
    return { error: "Enter a whole number between 1 and 99999." };
  }

  const totalMonthly = await writeAuditTargetTotalMonthly(parsed.data.value);
  revalidateTargetPaths();
  return { success: true as const, totalMonthly };
}
