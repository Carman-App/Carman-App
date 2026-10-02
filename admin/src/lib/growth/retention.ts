import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import { monthBounds } from "@/lib/money/mrr";
import { isoWeekKey, weekStart, monthKey, isActiveInWeek, ACTIVE_USER_CAVEAT } from "./definitions";

// GROW-03 — weekly and monthly cohort retention grid using the Retained
// definition (definitions.ts): an Account counted Active in its signup
// week/month, and Active again in a later week/month K periods after.
//
// IMPORTANT, real limitation (see ACTIVE_USER_CAVEAT): Account.lastApiRequestAt
// is a single timestamp, not a per-period activity log. An account can only
// ever be "Active" in the one period containing that single value — never in
// two different periods at once. That makes every K>0 cell in this grid
// structurally 0 for every cohort, always, regardless of real usage: this
// isn't a bug in the grid, it's what the schema can support today without a
// real per-period activity table. The grid is built to the correct shape
// (so it becomes meaningful the moment a real activity log exists) and the
// page states this plainly rather than hiding or faking a curve.

export const RETENTION_STRUCTURAL_LIMIT_NOTE =
  "Every column after week/month 0 will read 0 for every cohort: " + ACTIVE_USER_CAVEAT;

export const SMALL_COHORT_THRESHOLD = 5;

export type RetentionRow = {
  cohortKey: string;
  cohortStart: Date;
  cohortSize: number;
  retainedCount: number[]; // indexed by offset
  retainedPercent: (number | null)[]; // indexed by offset
};

export type RetentionGrid = {
  offsets: number[];
  rows: RetentionRow[];
};

export async function getWeeklyRetentionGrid(maxCohorts = 12, maxOffset = 8): Promise<RetentionGrid> {
  const accounts = await prisma.account.findMany({
    where: { deletedAt: null },
    select: { createdAt: true, lastApiRequestAt: true },
  });

  const byCohort = new Map<string, { cohortStart: Date; lastApiRequestAts: (Date | null)[] }>();
  for (const a of accounts) {
    const key = isoWeekKey(a.createdAt);
    let bucket = byCohort.get(key);
    if (!bucket) {
      bucket = { cohortStart: weekStart(a.createdAt), lastApiRequestAts: [] };
      byCohort.set(key, bucket);
    }
    bucket.lastApiRequestAts.push(a.lastApiRequestAt);
  }

  const sorted = [...byCohort.entries()].sort((a, b) => b[1].cohortStart.getTime() - a[1].cohortStart.getTime());
  const limited = sorted.slice(0, maxCohorts);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  const rows: RetentionRow[] = limited.map(([cohortKey, bucket]) => {
    const cohortSize = bucket.lastApiRequestAts.length;
    const retainedCount = offsets.map((k) => {
      const targetWeekStart = new Date(bucket.cohortStart.getTime() + k * 7 * 24 * 60 * 60 * 1000);
      return bucket.lastApiRequestAts.filter(
        (ts) => isActiveInWeek(ts, bucket.cohortStart) && isActiveInWeek(ts, targetWeekStart),
      ).length;
    });
    return {
      cohortKey,
      cohortStart: bucket.cohortStart,
      cohortSize,
      retainedCount,
      retainedPercent: retainedCount.map((c) => (cohortSize === 0 ? null : (c / cohortSize) * 100)),
    };
  });

  return { offsets, rows };
}

export async function getMonthlyRetentionGrid(maxCohorts = 6, maxOffset = 5): Promise<RetentionGrid> {
  const accounts = await prisma.account.findMany({
    where: { deletedAt: null },
    select: { createdAt: true, lastApiRequestAt: true },
  });

  const byCohort = new Map<string, { cohortStart: Date; lastApiRequestAts: (Date | null)[] }>();
  for (const a of accounts) {
    const key = monthKey(a.createdAt);
    let bucket = byCohort.get(key);
    if (!bucket) {
      bucket = { cohortStart: monthBounds(a.createdAt).start, lastApiRequestAts: [] };
      byCohort.set(key, bucket);
    }
    bucket.lastApiRequestAts.push(a.lastApiRequestAt);
  }

  const sorted = [...byCohort.entries()].sort((a, b) => b[1].cohortStart.getTime() - a[1].cohortStart.getTime());
  const limited = sorted.slice(0, maxCohorts);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  function isActiveInMonthOffset(ts: Date | null, cohortStart: Date, offset: number): boolean {
    if (!ts) return false;
    const targetMonthDate = new Date(Date.UTC(cohortStart.getUTCFullYear(), cohortStart.getUTCMonth() + offset, 1));
    const { start, end } = monthBounds(targetMonthDate);
    return ts >= start && ts < end;
  }

  const rows: RetentionRow[] = limited.map(([cohortKey, bucket]) => {
    const cohortSize = bucket.lastApiRequestAts.length;
    const retainedCount = offsets.map(
      (k) =>
        bucket.lastApiRequestAts.filter(
          (ts) => isActiveInMonthOffset(ts, bucket.cohortStart, 0) && isActiveInMonthOffset(ts, bucket.cohortStart, k),
        ).length,
    );
    return {
      cohortKey,
      cohortStart: bucket.cohortStart,
      cohortSize,
      retainedCount,
      retainedPercent: retainedCount.map((c) => (cohortSize === 0 ? null : (c / cohortSize) * 100)),
    };
  });

  return { offsets, rows };
}
