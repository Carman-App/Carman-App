/**
 * Notification delivery. `notify()` always saves a Notification row (the
 * in-app feed) and then a background job delivers it to the account's
 * phones as a push notification (src/lib/notifications/push.ts), honouring
 * the person's notification settings. Email and SMS are not sent yet.
 */

import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";
import type { NotificationType } from "@/generated/prisma/enums";
import { ExpoPushProvider } from "./push";
import type { Prisma } from "@/generated/prisma/client";

export type OutboundNotification = {
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export interface NotificationProvider {
  send(notification: OutboundNotification & { id?: string }): Promise<void>;
}

/** Turns push off (PUSH_NOTIFICATIONS="off"), e.g. on a staging copy of production data. */
export class NoopNotificationProvider implements NotificationProvider {
  async send(): Promise<void> {}
}

export const notificationProvider: NotificationProvider =
  process.env.PUSH_NOTIFICATIONS === "off" ? new NoopNotificationProvider() : new ExpoPushProvider();

/**
 * Saves the in-app notification now (the app reads it from the list) and
 * hands outside delivery (push/SMS/email) to a background job, so a slow or
 * failing provider never slows down or fails the request that caused it.
 */
export async function notify(notification: OutboundNotification): Promise<void> {
  const row = await prisma.notification.create({
    data: {
      accountId: notification.accountId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: (notification.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await enqueue("notification.deliver", { notificationId: row.id });
}
