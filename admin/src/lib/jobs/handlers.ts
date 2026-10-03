import "server-only";
import { prisma } from "@/lib/prisma";
import { notificationProvider, notify } from "@/lib/notifications/provider";
import { buildAccountDataExport } from "@/lib/privacy/export";
import { purgeSelfDeletedAccounts } from "@/lib/accounts/self-delete";
import { syncStoreSubscriptions } from "@/lib/billing/store";
import { DataExportStatus, NotificationType, ReminderKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { JobName, JobPayloads } from "./queue";

/**
 * What each background job does. Every handler is safe to run twice: a
 * retried job must never send a duplicate or create a second row.
 */

const DOCUMENT_REMINDER_DAYS = 30;
const SCAN_BATCH = 500;

async function deliverNotification({ notificationId }: JobPayloads["notification.deliver"]) {
  const n = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!n) return; // deleted since: nothing to deliver
  await notificationProvider.send({
    id: n.id,
    accountId: n.accountId,
    type: n.type,
    title: n.title,
    body: n.body,
    metadata: (n.metadata as Record<string, unknown> | null) ?? undefined,
  });
}

/**
 * Daily: a reminder for every document expiring within 30 days, and a
 * notification to the garage owner the first time. sourceKey makes it
 * idempotent: a document renewed with a new expiry gets a new reminder.
 */
async function scanReminders() {
  const now = new Date();
  const horizon = new Date(now.getTime() + DOCUMENT_REMINDER_DAYS * 86_400_000);
  let cursor: string | undefined;
  let created = 0;

  for (;;) {
    const docs = await prisma.document.findMany({
      where: { deletedAt: null, expiryDate: { gte: now, lte: horizon } },
      select: { id: true, title: true, expiryDate: true, vehicleId: true, vehicle: { select: { model: true, garage: { select: { ownerId: true } } } } },
      orderBy: { id: "asc" },
      take: SCAN_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (docs.length === 0) break;
    cursor = docs[docs.length - 1].id;

    for (const d of docs) {
      const expiry = d.expiryDate!;
      const sourceKey = `doc-expiry:${d.id}:${expiry.toISOString().slice(0, 10)}`;
      try {
        await prisma.reminder.create({
          data: { vehicleId: d.vehicleId, kind: ReminderKind.DOCUMENT_EXPIRY, dueDate: expiry, description: `${d.title} expires`, sourceKey },
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") continue; // already reminded
        throw e;
      }
      created += 1;
      const days = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000));
      await notify({
        accountId: d.vehicle.garage.ownerId,
        type: NotificationType.DOCUMENT_EXPIRING,
        title: `${d.title} expires in ${days} day${days === 1 ? "" : "s"}`,
        body: `For the ${d.vehicle.model}. Renew it and add the new one to keep the history complete.`,
        metadata: { documentId: d.id, vehicleId: d.vehicleId },
      });
    }
    if (docs.length < SCAN_BATCH) break;
  }
  console.log(`[jobs] reminders.scan created ${created}`);
}

async function generateExport({ requestId }: JobPayloads["privacy.export"]) {
  const request = await prisma.dataExportRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== DataExportStatus.REQUESTED) return;
  const payload = await buildAccountDataExport(request.accountId);
  if (!payload) throw new Error(`Account ${request.accountId} not found for export ${requestId}.`);
  await prisma.dataExportRequest.update({
    where: { id: requestId },
    data: { status: DataExportStatus.GENERATED, recordCounts: payload.recordCounts as Prisma.InputJsonValue },
  });
}

/** Daily: permanently removes accounts their owners deleted more than 30 days ago. */
async function purgeAccounts() {
  const n = await purgeSelfDeletedAccounts();
  console.log(`[jobs] accounts.purge removed ${n}`);
}

const HANDLERS: { [N in JobName]: (data: JobPayloads[N]) => Promise<void> } = {
  "notification.deliver": deliverNotification,
  "reminders.scan": scanReminders,
  "privacy.export": generateExport,
  "accounts.purge": purgeAccounts,
  "billing.sync": ({ accountId }) => syncStoreSubscriptions(accountId),
};

export async function runJob<N extends JobName>(name: N, data: JobPayloads[N]): Promise<void> {
  const handler = HANDLERS[name] as (d: JobPayloads[N]) => Promise<void>;
  if (!handler) throw new Error(`Unknown job: ${name}`);
  await handler(data);
}
