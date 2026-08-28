/**
 * Notification delivery abstraction (email/SMS/push).
 *
 * No real provider is wired up yet — that needs credentials the user
 * hasn't provided. `notify()` below always persists a Notification row
 * (so the in-app notification feed works today) and calls whatever
 * `NotificationProvider` is configured; the default is a no-op, so
 * delivery is silently skipped until a real provider is dropped in.
 */

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type OutboundNotification = {
  accountId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export interface NotificationProvider {
  send(notification: OutboundNotification): Promise<void>;
}

export class NoopNotificationProvider implements NotificationProvider {
  async send(): Promise<void> {
    // Intentionally does nothing — no email/SMS/push credentials configured.
    // Swap this for a real provider (SES, Twilio, FCM, ...) later.
  }
}

export const notificationProvider: NotificationProvider = new NoopNotificationProvider();

/** Persist the notification and hand it to the configured provider. */
export async function notify(notification: OutboundNotification): Promise<void> {
  await prisma.notification.create({
    data: {
      accountId: notification.accountId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: (notification.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await notificationProvider.send(notification);
}
