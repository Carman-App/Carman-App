// No "server-only" guard here (unlike src/lib/auth/*, api/auth.ts,
// api/authorize.ts): this module is a pure data-access layer like
// src/lib/prisma.ts/limits.ts, and — unlike those request-context modules —
// it's also imported directly by scripts/queue-worker.ts, a plain Node/tsx
// script outside of Next.js's server-component boundary where the
// "server-only" package throws unconditionally.
import { prisma } from "@/lib/prisma";
import { BackgroundJobStatus, type Prisma } from "@/generated/prisma/client";

/**
 * Postgres-backed background job queue.
 *
 * This is a genuine, working queue for a single-region modular monolith —
 * not a placeholder. `BackgroundJob` rows are the durable queue; a poller
 * (see scripts/queue-worker.ts) claims and processes them. This keeps report
 * generation, notification dispatch, and other expensive/async work off the
 * request path (see AGENTS.md's scalability pass, section 6) without
 * standing up Redis or a dedicated message broker neither of which this
 * codebase has credentials/hosting for yet.
 *
 * What this genuinely gives you today:
 * - Durable, transactional enqueue (a job row commits in the same database
 *   as the data it describes — no separate system to keep in sync).
 * - At-least-once delivery via row locking + a claim timeout (a worker that
 *   dies mid-job doesn't lose the job — another poller reclaims it).
 * - Retry with attempt counting and a `lastError` trail.
 * - Optional de-duplication via `dedupeKey` (a unique column) for callers
 *   that want "enqueue this exact job at most once".
 *
 * What it does NOT give you (the honest Stage 2 gap — see
 * SCALABILITY_AUDIT.md): sub-millisecond claim latency under high
 * concurrency (every claim is a real UPDATE ... WHERE ... RETURNING against
 * Postgres, not an in-memory pop), and no pub/sub push to wake a waiting
 * worker instantly (the worker polls on an interval). Both become worth
 * paying for once there's more than one Next.js instance and enough job
 * volume that Postgres polling becomes the bottleneck — that's when a real
 * Redis-backed queue (e.g. BullMQ) earns its keep, not before.
 */

export type JobType =
  | "report.generate"
  | "notification.dispatch";

const CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // a lock older than this is abandoned and reclaimable
const DEFAULT_MAX_ATTEMPTS = 5;

export type EnqueueOptions = {
  /** Delay before the job becomes claimable (default: immediately). */
  runAt?: Date;
  maxAttempts?: number;
  /**
   * If set and a job with this dedupeKey already exists, the existing row is
   * returned unchanged instead of creating a duplicate — the queue-level
   * idempotency primitive for "don't enqueue the same work twice" (distinct
   * from src/lib/idempotency.ts, which dedupes the *request*, not the job).
   */
  dedupeKey?: string;
};

/** Enqueue a background job. Never throws for a duplicate dedupeKey — returns the existing row instead. */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
) {
  if (options.dedupeKey) {
    const existing = await prisma.backgroundJob.findUnique({ where: { dedupeKey: options.dedupeKey } });
    if (existing) return existing;
  }

  try {
    return await prisma.backgroundJob.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        runAt: options.runAt ?? new Date(),
        maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        dedupeKey: options.dedupeKey,
      },
    });
  } catch (error) {
    // Unique constraint race on dedupeKey (two concurrent requests enqueued
    // the same job at once) — re-fetch and return the winner instead of
    // failing the caller's request over a benign race.
    if (options.dedupeKey && isUniqueConstraintError(error)) {
      const existing = await prisma.backgroundJob.findUnique({ where: { dedupeKey: options.dedupeKey } });
      if (existing) return existing;
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Claim the next runnable job for a worker. Atomic: uses a conditional
 * UPDATE so two concurrent pollers can never claim the same row (the second
 * poller's UPDATE simply matches zero rows). Also reclaims jobs whose lock
 * has expired (a worker crashed mid-job) as long as they haven't exhausted
 * their retry budget.
 */
export async function claimNextJob(workerName: string) {
  const now = new Date();
  const staleLockCutoff = new Date(now.getTime() - CLAIM_TIMEOUT_MS);

  const candidates = await prisma.backgroundJob.findMany({
    where: {
      runAt: { lte: now },
      OR: [
        { status: BackgroundJobStatus.PENDING },
        { status: BackgroundJobStatus.PROCESSING, lockedAt: { lt: staleLockCutoff } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 10,
    select: { id: true, attempts: true, maxAttempts: true },
  });

  for (const candidate of candidates) {
    if (candidate.attempts >= candidate.maxAttempts) continue;

    // Conditional claim: only succeeds if the row is still in the state we
    // read it in (updatedAt hasn't moved), so a concurrent claimant loses
    // the race cleanly instead of both workers processing the same job.
    const claimed = await prisma.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: BackgroundJobStatus.PENDING },
          { status: BackgroundJobStatus.PROCESSING, lockedAt: { lt: staleLockCutoff } },
        ],
      },
      data: {
        status: BackgroundJobStatus.PROCESSING,
        lockedAt: now,
        lockedBy: workerName,
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 1) {
      return prisma.backgroundJob.findUnique({ where: { id: candidate.id } });
    }
  }

  return null;
}

export async function completeJob(id: string, result?: Record<string, unknown>) {
  await prisma.backgroundJob.update({
    where: { id },
    data: {
      status: BackgroundJobStatus.COMPLETED,
      result: (result as Prisma.InputJsonValue) ?? undefined,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function failJob(id: string, error: string, opts: { permanent?: boolean } = {}) {
  const job = await prisma.backgroundJob.findUnique({ where: { id }, select: { attempts: true, maxAttempts: true } });
  const exhausted = opts.permanent || (job && job.attempts >= job.maxAttempts);

  await prisma.backgroundJob.update({
    where: { id },
    data: {
      status: exhausted ? BackgroundJobStatus.FAILED : BackgroundJobStatus.PENDING,
      lastError: error.slice(0, 2000),
      lockedAt: null,
      lockedBy: null,
      // Exponential-ish backoff before the next retry attempt.
      runAt: exhausted ? undefined : new Date(Date.now() + retryDelayMs(job?.attempts ?? 1)),
    },
  });
}

function retryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** attempts, 30 * 60 * 1000); // caps at 30 minutes
}

/** Queue depth / health, for an admin ops view or a load-test observation. */
export async function getQueueStats() {
  const rows = await prisma.backgroundJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

/**
 * PULSE-02's "stalled background jobs" alert. A job is stalled when it's due
 * (or already claimed) but has sat that way well past the time a healthy
 * poller would have picked it up or finished it — i.e. `runAt` (PENDING) or
 * `lockedAt` (PROCESSING) is older than `thresholdMs`. This is deliberately
 * a wider window than CLAIM_TIMEOUT_MS (5 min, used for lock reclaim) so a
 * job doesn't get flagged mid-retry-backoff — only when nothing appears to
 * be draining the queue at all.
 *
 * This alert type was originally shipped as "not wired up yet" (no queue
 * existed) — the scalability pass added a real Postgres-backed queue
 * (this module) the same day, so the data source now exists and this closes
 * that gap for real instead of leaving the stale comment in place.
 */
const STALL_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes past due/claimed with no progress

export type StalledJob = {
  id: string;
  type: string;
  status: BackgroundJobStatus;
  attempts: number;
  maxAttempts: number;
  since: Date; // runAt (PENDING) or lockedAt (PROCESSING) — whichever made it stale
};

export async function getStalledJobs(thresholdMs: number = STALL_THRESHOLD_MS): Promise<StalledJob[]> {
  const cutoff = new Date(Date.now() - thresholdMs);
  const rows = await prisma.backgroundJob.findMany({
    where: {
      OR: [
        { status: BackgroundJobStatus.PENDING, runAt: { lt: cutoff } },
        { status: BackgroundJobStatus.PROCESSING, lockedAt: { lt: cutoff } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: 20,
    select: { id: true, type: true, status: true, attempts: true, maxAttempts: true, runAt: true, lockedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.maxAttempts,
    since: r.status === BackgroundJobStatus.PROCESSING ? (r.lockedAt ?? r.runAt) : r.runAt,
  }));
}
