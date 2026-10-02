/**
 * Notification delivery abstraction (email/SMS/push).
 *
 * No real provider is wired up yet — that needs credentials the user
 * hasn't provided. `notify()` below always persists a Notification row
 * synchronously (so the in-app notification feed is immediately consistent
 * — a fast, cheap local insert, never worth deferring) and then ENQUEUES
 * delivery via the background job queue instead of calling the provider
 * inline (AGENTS.md section 11: "never make the main request wait on an
 * external provider; handle provider failure/retry safely"). The queue
 * worker (scripts/queue-worker.ts) is what actually calls
 * `notificationProvider.send()`, with the queue's existing retry/backoff
 * (see src/lib/queue/queue.ts) covering provider failure once a real
 * provider is configured. Today that provider is still a no-op, so this
 * change is architectural (the request path never blocks on send, and a
 * future flaky provider gets retried) rather than visibly different in
 * dev.
 */

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { enqueueJob } from "@/lib/queue/queue";

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

/**
 * Persist the notification (immediate — powers the in-app feed) and enqueue
 * provider delivery (deferred — see module comment above). Never throws on
 * the enqueue step failing to reach a provider; that's the queue/worker's
 * problem to retry, not this request's.
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
  await enqueueJob(
    "notification.dispatch",
    { notificationId: row.id },
    { dedupeKey: `notification.dispatch:${row.id}` },
  );
}
