// Shared job-processing logic used by both scripts/queue-worker.ts (the
// polling consumer) and the System page's manual "Retry now" action
// (src/app/(dashboard)/system/actions.ts, OPS-03: "retry a failed job for
// one account ... outcome reported back"). Factored out of queue-worker.ts
// so a manual retry runs exactly the same handler code a poller would, and
// can report a real, synchronous outcome to the admin who clicked it instead
// of just re-queuing and hoping.
//
// No "server-only" guard, matching src/lib/queue/queue.ts's own choice —
// this needs to be importable from queue-worker.ts, a plain Node/tsx script
// outside Next.js's server-component boundary where "server-only" throws.
import { prisma } from "@/lib/prisma";
import { completeJob, failJob } from "./queue";
import { notificationProvider } from "@/lib/notifications/provider";

async function processReportGenerate(payload: { reportId: string }) {
  // No PDF/CSV renderer or object-storage credential exists in this codebase
  // yet (see src/lib/storage.ts) — this honestly records that the job ran,
  // without fabricating a rendered file.
  const report = await prisma.report.findUnique({ where: { id: payload.reportId } });
  if (!report) throw new Error(`Report ${payload.reportId} not found`);
  return { reportId: report.id, rendered: false, reason: "no PDF/CSV renderer configured" };
}

async function processNotificationDispatch(payload: { notificationId: string }) {
  const notification = await prisma.notification.findUnique({ where: { id: payload.notificationId } });
  if (!notification) throw new Error(`Notification ${payload.notificationId} not found`);
  await notificationProvider.send({
    accountId: notification.accountId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    metadata: (notification.metadata as Record<string, unknown> | null) ?? undefined,
  });
  return { notificationId: notification.id, delivered: true };
}

export type JobOutcome = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };

/**
 * Runs one job's handler synchronously and records the terminal outcome via
 * completeJob/failJob — the exact same state transition a poller would leave
 * the row in. Unknown job types fail cleanly rather than silently no-op-ing.
 */
export async function runJobNow(job: { id: string; type: string; payload: unknown }): Promise<JobOutcome> {
  try {
    let result: Record<string, unknown>;
    switch (job.type) {
      case "report.generate":
        result = await processReportGenerate(job.payload as { reportId: string });
        break;
      case "notification.dispatch":
        result = await processNotificationDispatch(job.payload as { notificationId: string });
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
    await completeJob(job.id, result);
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(job.id, message);
    return { ok: false, error: message };
  }
}
