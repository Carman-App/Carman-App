import { prismaRead as prisma } from "@/lib/prisma";
import { JobStatus } from "@/generated/prisma/enums";

// WORK-05 — "jobs open longer than a threshold" needs a defensible number.
// 14 days is picked as a first pass: long enough that a job sitting there
// isn't just normal turnaround, short enough to actually surface something.
// Named here so it's easy for an operator to find and argue with later.
export const JOB_AGE_ALERT_THRESHOLD_DAYS = 14;

// A job in one of these statuses is done moving — it's not "open" no matter
// how old it is, so it's excluded from the staleness list (though it still
// counts in the by-state totals/medians).
export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  JobStatus.PAID,
  JobStatus.DECLINED,
  JobStatus.CANCELLED,
];

export type JobAgeRow = {
  id: string;
  status: JobStatus;
  workshopId: string;
  workshopName: string;
  faultDescription: string;
  ageDays: number;
  /** Whether the age came from real JobStatusEvent history or the updatedAt fallback — see the honesty footnote in the UI. */
  ageSource: "status_event" | "updated_at_fallback";
};

export type JobStateAging = {
  status: JobStatus;
  count: number;
  medianAgeDays: number | null;
};

export type JobAgingReport = {
  byState: JobStateAging[];
  totalJobs: number;
  /** Jobs whose current-status age uses real JobStatusEvent history (see the honesty footnote). */
  jobsWithEventHistory: number;
  /** Jobs open (non-terminal) longer than JOB_AGE_ALERT_THRESHOLD_DAYS, oldest first. */
  staleJobs: JobAgeRow[];
};

/**
 * Builds the platform-wide job-state-with-age report for WORK-05.
 *
 * "Age" = time since the job entered its CURRENT status. Where a
 * JobStatusEvent row exists for (job, currentStatus) we use the latest one's
 * changedAt; JobStatusEvent only started being written once the
 * /api/v1/jobs/:id/status route was wired up (see that route), so jobs whose
 * current status predates that change have no event and fall back to
 * Job.updatedAt as a "time entered current state" proxy. jobsWithEventHistory
 * tells the UI how many jobs are on the real signal vs. the fallback.
 */
export async function getJobAgingReport(): Promise<JobAgingReport> {
  const [jobs, events] = await Promise.all([
    prisma.job.findMany({
      select: {
        id: true,
        status: true,
        workshopId: true,
        workshop: { select: { name: true } },
        faultDescription: true,
        updatedAt: true,
      },
    }),
    prisma.jobStatusEvent.findMany({
      select: { jobId: true, toStatus: true, changedAt: true },
    }),
  ]);

  // Latest changedAt per (jobId, toStatus) — the most recent time that job
  // transitioned INTO that status (relevant if a job re-enters a status).
  const latestByJobStatus = new Map<string, number>();
  for (const event of events) {
    const key = `${event.jobId}::${event.toStatus}`;
    const ts = event.changedAt.getTime();
    const existing = latestByJobStatus.get(key);
    if (existing === undefined || ts > existing) latestByJobStatus.set(key, ts);
  }

  const now = Date.now();
  let jobsWithEventHistory = 0;

  const rows: JobAgeRow[] = jobs.map((job) => {
    const key = `${job.id}::${job.status}`;
    const eventTs = latestByJobStatus.get(key);
    const usedEvent = eventTs !== undefined;
    if (usedEvent) jobsWithEventHistory += 1;
    const enteredAt = usedEvent ? eventTs! : job.updatedAt.getTime();
    const ageDays = (now - enteredAt) / (1000 * 60 * 60 * 24);
    return {
      id: job.id,
      status: job.status,
      workshopId: job.workshopId,
      workshopName: job.workshop.name,
      faultDescription: job.faultDescription,
      ageDays,
      ageSource: usedEvent ? "status_event" : "updated_at_fallback",
    };
  });

  const agesByState = new Map<JobStatus, number[]>();
  for (const row of rows) {
    const arr = agesByState.get(row.status) ?? [];
    arr.push(row.ageDays);
    agesByState.set(row.status, arr);
  }

  const byState: JobStateAging[] = (Object.values(JobStatus) as JobStatus[]).map((status) => {
    const ages = (agesByState.get(status) ?? []).slice().sort((a, b) => a - b);
    const count = ages.length;
    let medianAgeDays: number | null = null;
    if (count > 0) {
      const mid = Math.floor(count / 2);
      medianAgeDays = count % 2 === 0 ? (ages[mid - 1] + ages[mid]) / 2 : ages[mid];
    }
    return { status, count, medianAgeDays };
  });

  const staleJobs = rows
    .filter((row) => !TERMINAL_JOB_STATUSES.includes(row.status) && row.ageDays > JOB_AGE_ALERT_THRESHOLD_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays);

  return { byState, totalJobs: jobs.length, jobsWithEventHistory, staleJobs };
}
