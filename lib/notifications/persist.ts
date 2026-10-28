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
 * Non-audit notification (e.g. agent transfer). Idempotent per
 * (userId, type, meta.dedupeKey) so retried actions do not double-notify.
 */
export async function persistUserNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  dedupeKey: string;
  meta?: Record<string, Prisma.InputJsonValue | null>;
}): Promise<NotificationItem | null> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      meta: { path: ["dedupeKey"], equals: input.dedupeKey },
    },
  });
  if (existing) return mapNotificationRow(existing);

  const created = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      meta: { ...(input.meta ?? {}), dedupeKey: input.dedupeKey },
    },
  });
  const notification = mapNotificationRow(created);
  broadcastToUser(input.userId, { type: "notification:new", notification });
  return notification;
}

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
