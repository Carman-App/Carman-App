import "server-only";
import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

/**
 * Background work. Anything slow or that talks to an outside service runs
 * here, not inside the API request: notification delivery, the daily
 * reminder scan, data exports. Jobs retry with exponential backoff.
 *
 * Production: BullMQ on REDIS_URL, processed by the worker process
 * (`npm run worker`, src/worker/index.ts), scaled separately from the API.
 * Development without Redis: the job runs in this process right after the
 * response, so features behave the same with no extra setup.
 */

export const QUEUE_NAME = "carma";

export type JobPayloads = {
  "notification.deliver": { notificationId: string };
  "reminders.scan": Record<string, never>;
  "privacy.export": { requestId: string };
};
export type JobName = keyof JobPayloads;

const DEFAULTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

const g = globalThis as unknown as { carmaQueue?: Queue | null };

/** A dedicated connection: BullMQ needs maxRetriesPerRequest: null. */
export function queueConnection(): IORedis | null {
  const url = process.env.REDIS_URL;
  return url ? new IORedis(url, { maxRetriesPerRequest: null }) : null;
}

function getQueue(): Queue | null {
  if (g.carmaQueue !== undefined) return g.carmaQueue;
  const connection = queueConnection();
  g.carmaQueue = connection ? new Queue(QUEUE_NAME, { connection, defaultJobOptions: DEFAULTS }) : null;
  return g.carmaQueue;
}

export async function enqueue<N extends JobName>(name: N, data: JobPayloads[N], opts?: JobsOptions): Promise<void> {
  const queue = getQueue();
  if (queue) {
    await queue.add(name, data, opts);
    return;
  }
  // No Redis: run in-process once the current request has finished.
  setTimeout(() => {
    void import("./handlers")
      .then(({ runJob }) => runJob(name, data))
      .catch((err: unknown) => console.error(`[jobs] ${name} failed`, err));
  }, 0);
}
