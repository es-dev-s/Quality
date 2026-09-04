import type { Prisma } from "@prisma/client";
import { isPrismaUniqueViolation } from "@/lib/db/prisma-errors";
import { prisma } from "@/lib/prisma";
import { mapNotificationRow } from "@/lib/notifications/map-row";
import type { NotificationItem } from "@/lib/notifications/types";
import { broadcastToUser } from "@/lib/sse-broadcast";

type PersistNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  auditId: string;
  auditCode: string;
  meta?: Prisma.InputJsonValue;
};

/**
 * Create-or-skip by (userId, type, auditId). Unique constraint makes concurrent
 * fatal/dispute dispatches safe.
 */
export async function persistAndBroadcastNotification(
  input: PersistNotificationInput
): Promise<NotificationItem | null> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      auditId: input.auditId,
    },
  });
  if (existing) {
    return mapNotificationRow(existing);
  }

  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        auditId: input.auditId,
        auditCode: input.auditCode,
        meta: input.meta,
      },
    });
    const notification = mapNotificationRow(created);
    broadcastToUser(input.userId, {
      type: "notification:new",
      notification,
    });
    return notification;
  } catch (error) {
    if (!isPrismaUniqueViolation(error)) throw error;
    const raced = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        auditId: input.auditId,
      },
    });
    return raced ? mapNotificationRow(raced) : null;
  }
}
