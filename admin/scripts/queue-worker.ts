/**
 * Interim background-job worker: a polling consumer for the BackgroundJob
 * queue (src/lib/queue/queue.ts). This is the dev-only stand-in for a real
 * always-on worker process — see AGENTS.md's scalability pass, section 6,
 * and SCALABILITY_AUDIT.md's Stage 2. Run it alongside `npm run dev`:
 *
 *   npm run queue:worker
 *
 * It polls the queue every POLL_INTERVAL_MS, claims up to one job per tick,
 * processes it, and sweeps expired idempotency-key/rate-limit rows. It is
 * deliberately a plain script (tsx, same pattern as scripts/create-admin.ts
 * and prisma/seed.ts), not a hosted daemon — deploying this as a real
 * always-on worker process (a container, a Vercel background function, a
 * separate dyno, etc.) is a hosting decision this pass doesn't make
 * unilaterally, since it needs real infrastructure/credentials this
 * repository doesn't have.
 *
 * Job handlers below are intentionally honest about what this codebase can
 * and can't do: "report.generate" marks the report processed without
 * producing a real PDF/CSV file (no renderer or storage credential exists —
 * see src/lib/storage.ts); "notification.dispatch" calls the configured
 * NotificationProvider, which is a no-op until real email/SMS/push
 * credentials exist (see src/lib/notifications/provider.ts).
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { claimNextJob } from "@/lib/queue/queue";
import { runJobNow } from "@/lib/queue/handlers";
import { sweepExpiredIdempotencyKeys } from "@/lib/idempotency";
import { sweepExpiredRateLimitBuckets } from "@/lib/rateLimit";
import { logBackgroundJob } from "@/lib/logging/logger";

const POLL_INTERVAL_MS = 2000;
const WORKER_NAME = `worker-${process.pid}`;
const SWEEP_EVERY_N_TICKS = 30; // ~once a minute at the default poll interval

// Handler logic itself lives in src/lib/queue/handlers.ts, shared with the
// System page's manual "Retry now" action (OPS-02/03) so a poller retry and
// an admin-triggered retry run identical code and leave the job row in the
// same terminal state either way.
async function processJob(job: { id: string; type: string; payload: unknown; attempts: number }) {
  const startedAt = Date.now();
  logBackgroundJob({ jobId: job.id, jobType: job.type, status: "started", attempts: job.attempts });
  const outcome = await runJobNow(job);
  if (outcome.ok) {
    logBackgroundJob({
      jobId: job.id,
      jobType: job.type,
      status: "completed",
      durationMs: Date.now() - startedAt,
      attempts: job.attempts,
    });
  } else {
    logBackgroundJob({
      jobId: job.id,
      jobType: job.type,
      status: "failed",
      durationMs: Date.now() - startedAt,
      attempts: job.attempts,
      error: outcome.error,
    });
  }
}

async function tick(tickCount: number) {
  const job = await claimNextJob(WORKER_NAME);
  if (job) {
    await processJob(job);
  }

  if (tickCount % SWEEP_EVERY_N_TICKS === 0) {
    const [idempotencySwept, rateLimitSwept] = await Promise.all([
      sweepExpiredIdempotencyKeys(),
      sweepExpiredRateLimitBuckets(),
    ]);
    if (idempotencySwept || rateLimitSwept) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          type: "queue_worker_sweep",
          idempotencyKeysDeleted: idempotencySwept,
          rateLimitBucketsDeleted: rateLimitSwept,
        }),
      );
    }
  }
}

async function main() {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      type: "queue_worker_start",
      worker: WORKER_NAME,
      pollIntervalMs: POLL_INTERVAL_MS,
    }),
  );

  let tickCount = 0;
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    tickCount += 1;
    try {
      await tick(tickCount);
    } catch (error) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          type: "queue_worker_tick_error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
