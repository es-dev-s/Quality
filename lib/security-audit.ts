import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SECURITY_AUDIT_ACTIONS = {
  PASSWORD_READ: "PASSWORD_READ",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_ACTIVATED: "USER_ACTIVATED",
} as const;

export async function logSecurityAudit(input: {
  action: string;
  actorUserId: string;
  targetUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.securityAuditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
