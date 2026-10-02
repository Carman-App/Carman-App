import "server-only";
import { prisma } from "@/lib/prisma";
import { BackgroundJobStatus } from "@/generated/prisma/enums";
import { getQueueStats } from "@/lib/queue/queue";

// OPS-02/03 — background job visibility + retry, backed by the real
// Postgres BackgroundJob queue built in the scalability pass (see
// SCALABILITY_AUDIT.md section 6, src/lib/queue/queue.ts). System/page.tsx
// previously described this as "no job queue exists in this codebase
// today" — that was true when Phase Three first shipped, but stopped being
// true once the scalability pass added a real, working queue; this module
// (and the page section built on it) closes that staleness for real instead
// of leaving the outdated "not connected" placeholder in place.

/** Which account a job is "about", resolved from its payload — the same two job types the queue supports today (report.generate, notification.dispatch). */
export async function resolveAccountForJob(
  type: string,
  payload: unknown,
): Promise<{ id: string; name: string } | null> {
  if (type === "report.generate") {
    const reportId = (payload as { reportId?: string } | null)?.reportId;
    if (!reportId) return null;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { generatedByAccountId: true },
    });
    if (!report?.generatedByAccountId) return null;
    const account = await prisma.account.findUnique({
      where: { id: report.generatedByAccountId },
      select: { user: { select: { name: true } } },
    });
    return { id: report.generatedByAccountId, name: account?.user.name ?? "Unknown" };
  }
  if (type === "notification.dispatch") {
    const notificationId = (payload as { notificationId?: string } | null)?.notificationId;
    if (!notificationId) return null;
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { accountId: true },
    });
    if (!notification) return null;
    const account = await prisma.account.findUnique({
      where: { id: notification.accountId },
      select: { user: { select: { name: true } } },
    });
    return { id: notification.accountId, name: account?.user.name ?? "Unknown" };
  }
  return null;
}

export type FailedJobRow = {
  id: string;
  type: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  updatedAt: Date;
  accountId: string | null;
  accountName: string | null;
};

export type OldestWaitingJob = { id: string; type: string; runAt: Date; attempts: number };

export type JobQueueOverview = {
  /** queued (PENDING) / running (PROCESSING) / completed / failed counts, straight from getQueueStats(). */
  countsByStatus: Record<string, number>;
  /** Jobs that needed more than one attempt to reach their current state — the closest honest reading of "retried" this schema supports (there's no distinct RETRIED status; a retried job just goes back to PENDING with attempts > 1). */
  retriedCount: number;
  oldestWaiting: OldestWaitingJob | null;
  recentFailed: FailedJobRow[];
};

const RECENT_FAILED_LIMIT = 50;

export async function getJobQueueOverview(): Promise<JobQueueOverview> {
  const [countsByStatus, retriedCount, oldestWaitingRow, failedJobs] = await Promise.all([
    getQueueStats(),
    prisma.backgroundJob.count({ where: { attempts: { gt: 1 } } }),
    prisma.backgroundJob.findFirst({
      where: { status: BackgroundJobStatus.PENDING },
      orderBy: { runAt: "asc" },
      select: { id: true, type: true, runAt: true, attempts: true },
    }),
    prisma.backgroundJob.findMany({
      where: { status: BackgroundJobStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: RECENT_FAILED_LIMIT,
    }),
  ]);

  const recentFailed: FailedJobRow[] = await Promise.all(
    failedJobs.map(async (j) => {
      const account = await resolveAccountForJob(j.type, j.payload);
      return {
        id: j.id,
        type: j.type,
        attempts: j.attempts,
        maxAttempts: j.maxAttempts,
        lastError: j.lastError,
        updatedAt: j.updatedAt,
        accountId: account?.id ?? null,
        accountName: account?.name ?? null,
      };
    }),
  );

  return {
    countsByStatus,
    retriedCount,
    oldestWaiting: oldestWaitingRow,
    recentFailed,
  };
}
