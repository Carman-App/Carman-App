import "server-only";
import { prisma } from "@/lib/prisma";
import { monthBounds } from "@/lib/money/mrr";
import { isoWeekKey, weekStart, monthKey, getAccountRecordTimestamps } from "./definitions";

// GROW-03 — weekly and monthly cohort retention grid using the *spec's*
// Retained definition verbatim: "wrote a record in a later calendar week
// [/month] than the one they joined. Opening the app is not retention."
//
// Earlier version of this file used Account.lastApiRequestAt (the "Active
// user" proxy) instead — which is exactly the thing the spec calls out as
// NOT retention ("opening the app is not retention"), and which is also a
// single timestamp rather than a history, so every column after week/month 0
// was structurally 0 for every cohort regardless of real usage. Record
// writes (FuelRecord/ServiceRecord/RepairRecord/ExpenseRecord/OdometerReading
// via getAccountRecordTimestamps, definitions.ts) have real per-event
// timestamps, so an account can genuinely show up as retained in more than
// one later period. Fixed here to match the stated metric — see NOT-05 (never
// redefine a metric silently): this comment is that note.

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
  const [accounts, recordTimestamps] = await Promise.all([
    prisma.account.findMany({ where: { deletedAt: null }, select: { id: true, createdAt: true } }),
    getAccountRecordTimestamps(), // accountId -> every record timestamp ever, ascending (full history)
  ]);

  const byCohort = new Map<string, { cohortStart: Date; accountIds: string[] }>();
  for (const a of accounts) {
    const key = isoWeekKey(a.createdAt);
    let bucket = byCohort.get(key);
    if (!bucket) {
      bucket = { cohortStart: weekStart(a.createdAt), accountIds: [] };
      byCohort.set(key, bucket);
    }
    bucket.accountIds.push(a.id);
  }

  const sorted = [...byCohort.entries()].sort((a, b) => b[1].cohortStart.getTime() - a[1].cohortStart.getTime());
  const limited = sorted.slice(0, maxCohorts);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  const rows: RetentionRow[] = limited.map(([cohortKey, bucket]) => {
    const cohortSize = bucket.accountIds.length;
    // Which ISO weeks did each account in this cohort write at least one record in?
    const recordWeeksByAccount = bucket.accountIds.map(
      (id) => new Set((recordTimestamps.get(id) ?? []).map((ts) => isoWeekKey(ts))),
    );
    const retainedCount = offsets.map((k) => {
      const targetWeekKey = isoWeekKey(new Date(bucket.cohortStart.getTime() + k * 7 * 24 * 60 * 60 * 1000));
      return recordWeeksByAccount.filter((weeks) => weeks.has(targetWeekKey)).length;
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
  const [accounts, recordTimestamps] = await Promise.all([
    prisma.account.findMany({ where: { deletedAt: null }, select: { id: true, createdAt: true } }),
    getAccountRecordTimestamps(),
  ]);

  const byCohort = new Map<string, { cohortStart: Date; accountIds: string[] }>();
  for (const a of accounts) {
    const key = monthKey(a.createdAt);
    let bucket = byCohort.get(key);
    if (!bucket) {
      bucket = { cohortStart: monthBounds(a.createdAt).start, accountIds: [] };
      byCohort.set(key, bucket);
    }
    bucket.accountIds.push(a.id);
  }

  const sorted = [...byCohort.entries()].sort((a, b) => b[1].cohortStart.getTime() - a[1].cohortStart.getTime());
  const limited = sorted.slice(0, maxCohorts);
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  function monthKeyForOffset(cohortStart: Date, offset: number): string {
    const targetMonthDate = new Date(Date.UTC(cohortStart.getUTCFullYear(), cohortStart.getUTCMonth() + offset, 1));
    return monthKey(targetMonthDate);
  }

  const rows: RetentionRow[] = limited.map(([cohortKey, bucket]) => {
    const cohortSize = bucket.accountIds.length;
    // Which calendar months did each account in this cohort write at least one record in?
    const recordMonthsByAccount = bucket.accountIds.map(
      (id) => new Set((recordTimestamps.get(id) ?? []).map((ts) => monthKey(ts))),
    );
    const retainedCount = offsets.map((k) => {
      const targetMonthKey = monthKeyForOffset(bucket.cohortStart, k);
      return recordMonthsByAccount.filter((months) => months.has(targetMonthKey)).length;
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
