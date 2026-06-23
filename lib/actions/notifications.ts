"use server";

import { requireAuth } from "@/lib/auth";
import { mapNotificationRow } from "@/lib/notifications/dispatch-fatal-audit";
import type { NotificationItem } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const listSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

const idSchema = z.object({
  id: z.string().min(1),
});

export async function getNotifications(input?: {
  limit?: number;
}): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const session = await requireAuth();
  const parsed = listSchema.safeParse(input ?? {});
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  const where = { userId: session.user.id };

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { ...where, readAt: null },
    }),
  ]);

  return {
    items: rows.map(mapNotificationRow),
    unreadCount,
  };
}

export async function markNotificationRead(id: string) {
  const session = await requireAuth();
  const parsed = idSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: "Invalid notification." as const };
  }

  const updated = await prisma.notification.updateMany({
    where: {
      id: parsed.data.id,
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  if (updated.count === 0) {
    return { error: "Notification not found." as const };
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return { success: true as const, unreadCount };
}

export async function markAllNotificationsRead() {
  const session = await requireAuth();

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return { success: true as const, unreadCount: 0 };
}
