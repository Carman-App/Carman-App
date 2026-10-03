import "server-only";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/enums";
import type { NotificationProvider, OutboundNotification } from "./provider";

/**
 * Push delivery through Expo's push service, which hands each message to
 * Apple (APNs) or Google (FCM) for the app's store builds. The app registers
 * its Expo push token with POST /api/v1/push-tokens.
 *
 * EXPO_ACCESS_TOKEN is only needed when "enhanced push security" is turned on
 * for the project at expo.dev; without it the service accepts any sender.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100; // Expo's limit per request

/** The notification setting (My profile → Notifications) each type belongs to. */
const CATEGORY: Partial<Record<NotificationType, string>> = {
  [NotificationType.JOB_UPDATE]: "jobs",
  [NotificationType.ESTIMATE_READY]: "jobs",
  [NotificationType.INVOICE_ISSUED]: "money",
  [NotificationType.DOCUMENT_EXPIRING]: "docs",
  [NotificationType.ACCESS_REQUEST]: "members",
};

/** Settings that start switched off. */
const OFF_BY_DEFAULT = new Set(["idle"]);

export const NOTIFICATION_CATEGORIES = ["service", "docs", "jobs", "money", "members", "idle"] as const;

export function categoryOf(n: Pick<OutboundNotification, "type" | "metadata">): string | null {
  const fromMetadata = n.metadata?.category;
  if (typeof fromMetadata === "string") return fromMetadata;
  return CATEGORY[n.type] ?? null;
}

export function pushAllowed(prefs: unknown, category: string | null): boolean {
  if (!category) return true; // account and billing messages always go
  const value = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[category] : undefined;
  return typeof value === "boolean" ? value : !OFF_BY_DEFAULT.has(category);
}

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

export class ExpoPushProvider implements NotificationProvider {
  async send(n: OutboundNotification & { id?: string }): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: n.accountId },
      select: { notificationPrefs: true, deletedAt: true, suspendedAt: true, pushTokens: { select: { token: true } } },
    });
    if (!account || account.deletedAt || account.suspendedAt || account.pushTokens.length === 0) return;
    if (!pushAllowed(account.notificationPrefs, categoryOf(n))) return;

    const unread = await prisma.notification.count({ where: { accountId: n.accountId, readAt: null } });
    const tokens = account.pushTokens.map((t) => t.token);
    const messages = tokens.map((to) => ({
      to,
      title: n.title,
      body: n.body,
      sound: "default",
      badge: unread,
      channelId: "default",
      data: { notificationId: n.id ?? null, type: n.type, ...(n.metadata ?? {}) },
    }));

    const dead: string[] = [];
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      // 429/5xx: throw so the job retries with backoff.
      if (!res.ok) throw new Error(`Expo push failed: ${res.status} ${await res.text().catch(() => "")}`.trim());
      const { data } = (await res.json()) as { data?: Ticket[] };
      (data ?? []).forEach((ticket, j) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") dead.push(chunk[j].to);
        else if (ticket.status === "error") console.warn(`[push] ${ticket.details?.error ?? ticket.message}`);
      });
    }
    // The app was removed or notifications turned off: stop sending to it.
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
