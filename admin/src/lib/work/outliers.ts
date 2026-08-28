import { prisma } from "@/lib/prisma";
import { EstimateDecisionType } from "@/generated/prisma/enums";

// WORK-07 — outlier detection for decline/dispute/repeat-visit rates.
//
// MIN_JOB_COUNT_FOR_OUTLIER: below this a workshop's rates are too noisy to
// call an "outlier" off of (one bad week at a 3-job shop would swing a rate
// wildly) — named so it's easy to argue with later.
export const MIN_JOB_COUNT_FOR_OUTLIER = 10;

// A rate has to be at least this many times the platform median (among
// eligible workshops) to get flagged — plain "above average" is expected of
// roughly half of workshops by definition, so the bar is set higher than 1x.
export const OUTLIER_MEDIAN_MULTIPLIER = 1.5;

// When the platform median for a rate is exactly 0 (e.g. disputes, which are
// brand-new and likely all-zero right now), the multiplier above can't do
// anything (1.5 * 0 = 0), so anything nonzero would trivially "flag". To
// avoid that noise, a workshop only gets flagged off a zero median if it
// clears this small absolute floor too.
const ZERO_MEDIAN_ABSOLUTE_FLOOR = 0.05; // 5 percentage points, for the two rate metrics
const ZERO_MEDIAN_DISPUTE_FLOOR = 2; // at least 2 disputes, for the count metric

// Repeat-visit heuristic: two jobs on the same vehicle (by vehicleId, or by
// the freeform vehicleDescription when there's no linked Vehicle) at the
// same workshop, opened within this many days of each other, whose
// faultDescription case-insensitively matches exactly OR one contains the
// other (trimmed, and only for strings of at least 4 characters, to avoid
// trivial matches like "oil"). This is a simple heuristic, not a real
// fault-taxonomy match — documented here and in the UI.
const REPEAT_VISIT_WINDOW_DAYS = 90;
const REPEAT_VISIT_MIN_FAULT_LENGTH = 4;

export type WorkshopOutlierRow = {
  workshopId: string;
  workshopName: string;
  jobCount: number;
  estimateDecisionCount: number;
  estimateDeclineRate: number | null; // null when there are no decisions to rate
  disputeCount: number;
  repeatVisitRate: number;
  flags: {
    estimateDecline: boolean;
    dispute: boolean;
    repeatVisit: boolean;
  };
};

export type OutlierReport = {
  eligibleWorkshops: WorkshopOutlierRow[];
  medianEstimateDeclineRate: number | null;
  medianDisputeCount: number;
  medianRepeatVisitRate: number;
  totalWorkshopsConsidered: number;
  totalWorkshopsEligible: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isFlagged(value: number, med: number, zeroFloor: number): boolean {
  if (med > 0) return value > med * OUTLIER_MEDIAN_MULTIPLIER;
  return value > zeroFloor;
}

function normalizedFault(fault: string): string {
  return fault.trim().toLowerCase();
}

function faultsMatch(a: string, b: string): boolean {
  const na = normalizedFault(a);
  const nb = normalizedFault(b);
  if (na.length < REPEAT_VISIT_MIN_FAULT_LENGTH || nb.length < REPEAT_VISIT_MIN_FAULT_LENGTH) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function computeRepeatVisitRate(
  jobs: { id: string; vehicleId: string | null; vehicleDescription: string | null; faultDescription: string; createdAt: Date }[],
): number {
  if (jobs.length === 0) return 0;

  const byVehicle = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const vehicleKey = job.vehicleId ? `id:${job.vehicleId}` : `desc:${(job.vehicleDescription ?? "").trim().toLowerCase()}`;
    if (!vehicleKey || vehicleKey === "desc:") continue; // no way to identify the vehicle at all
    const arr = byVehicle.get(vehicleKey) ?? [];
    arr.push(job);
    byVehicle.set(vehicleKey, arr);
  }

  const repeatJobIds = new Set<string>();
  for (const vehicleJobs of byVehicle.values()) {
    if (vehicleJobs.length < 2) continue;
    const sorted = vehicleJobs.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const daysApart = Math.abs(sorted[j].createdAt.getTime() - sorted[i].createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysApart > REPEAT_VISIT_WINDOW_DAYS) break; // sorted by date, so nothing further out matches either
        if (faultsMatch(sorted[i].faultDescription, sorted[j].faultDescription)) {
          repeatJobIds.add(sorted[i].id);
          repeatJobIds.add(sorted[j].id);
        }
      }
    }
  }

  return repeatJobIds.size / jobs.length;
}

/** Builds the WORK-07 outlier report across every workshop with enough jobs to make a rate meaningful. */
export async function getOutlierReport(): Promise<OutlierReport> {
  const workshops = await prisma.workshop.findMany({
    select: {
      id: true,
      name: true,
      jobs: {
        select: { id: true, vehicleId: true, vehicleDescription: true, faultDescription: true, createdAt: true },
      },
      estimates: {
        select: {
          decisions: { select: { decision: true } },
        },
      },
      disputes: { select: { id: true } },
    },
  });

  const totalWorkshopsConsidered = workshops.length;

  const rowsRaw = workshops
    .map((workshop) => {
      const jobCount = workshop.jobs.length;
      const decisions = workshop.estimates.flatMap((e) => e.decisions);
      const estimateDecisionCount = decisions.length;
      const declineCount = decisions.filter((d) => d.decision === EstimateDecisionType.DECLINED).length;
      const estimateDeclineRate = estimateDecisionCount > 0 ? declineCount / estimateDecisionCount : null;
      const disputeCount = workshop.disputes.length;
      const repeatVisitRate = computeRepeatVisitRate(workshop.jobs);

      return {
        workshopId: workshop.id,
        workshopName: workshop.name,
        jobCount,
        estimateDecisionCount,
        estimateDeclineRate,
        disputeCount,
        repeatVisitRate,
      };
    })
    .filter((row) => row.jobCount >= MIN_JOB_COUNT_FOR_OUTLIER);

  const totalWorkshopsEligible = rowsRaw.length;

  const medianEstimateDeclineRate = median(
    rowsRaw.map((r) => r.estimateDeclineRate).filter((v): v is number => v !== null),
  );
  const declineRatesExist = rowsRaw.some((r) => r.estimateDeclineRate !== null);
  const medianDisputeCount = median(rowsRaw.map((r) => r.disputeCount));
  const medianRepeatVisitRate = median(rowsRaw.map((r) => r.repeatVisitRate));

  const eligibleWorkshops: WorkshopOutlierRow[] = rowsRaw
    .map((row) => ({
      ...row,
      estimateDeclineRate: row.estimateDeclineRate,
      flags: {
        estimateDecline:
          row.estimateDeclineRate !== null && isFlagged(row.estimateDeclineRate, medianEstimateDeclineRate, ZERO_MEDIAN_ABSOLUTE_FLOOR),
        dispute: isFlagged(row.disputeCount, medianDisputeCount, ZERO_MEDIAN_DISPUTE_FLOOR),
        repeatVisit: isFlagged(row.repeatVisitRate, medianRepeatVisitRate, ZERO_MEDIAN_ABSOLUTE_FLOOR),
      },
    }))
    .sort((a, b) => {
      const aFlags = Number(a.flags.estimateDecline) + Number(a.flags.dispute) + Number(a.flags.repeatVisit);
      const bFlags = Number(b.flags.estimateDecline) + Number(b.flags.dispute) + Number(b.flags.repeatVisit);
      return bFlags - aFlags;
    });

  return {
    eligibleWorkshops,
    medianEstimateDeclineRate: declineRatesExist ? medianEstimateDeclineRate : null,
    medianDisputeCount,
    medianRepeatVisitRate,
    totalWorkshopsConsidered,
    totalWorkshopsEligible,
  };
}
