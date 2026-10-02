/**
 * Background worker: `npm run worker`. Runs as its own process (scale it
 * separately from the web/API service) and needs REDIS_URL and DATABASE_URL.
 */
import "../../load-env";
import { Worker } from "bullmq";
import { QUEUE_NAME, queueConnection, type JobName } from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/handlers";
import { Queue } from "bullmq";
import * as Sentry from "@sentry/node";

async function main() {
  const connection = queueConnection();
  if (!connection) {
    console.error("[worker] REDIS_URL is not set. Without Redis, jobs run inside the API process and no worker is needed.");
    process.exit(1);
  }

  if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SENTRY_ENVIRONMENT ?? "production" });

  const concurrency = Number(process.env.WORKER_CONCURRENCY) || 10;
  const worker = new Worker(QUEUE_NAME, (job) => runJob(job.name as JobName, job.data), { connection, concurrency });
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name} ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
    // Report once the job has used every retry, not on each attempt.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) Sentry.captureException(err, { tags: { job: job.name }, extra: { jobId: job.id } });
  });
  worker.on("error", (err) => console.error("[worker]", err.message));

  // The daily reminder scan, 03:15 East Africa Time. Upserting keeps exactly one schedule however many workers start.
  const scheduler = new Queue(QUEUE_NAME, { connection: queueConnection()! });
  await scheduler.upsertJobScheduler("reminders-daily", { pattern: "15 3 * * *", tz: "Africa/Nairobi" }, { name: "reminders.scan", data: {} });
  await scheduler.upsertJobScheduler("accounts-purge-daily", { pattern: "45 3 * * *", tz: "Africa/Nairobi" }, { name: "accounts.purge", data: {} });

  console.log(`[worker] processing "${QUEUE_NAME}" with concurrency ${concurrency}`);

  const stop = async () => {
    console.log("[worker] finishing current jobs…");
    await worker.close();
    await scheduler.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

void main();
