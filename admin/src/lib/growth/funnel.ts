import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import { isoWeekKey, weekStart, getAccountRecordTimestamps } from "./definitions";

// GROW-01 — "signup -> verified -> garage created -> vehicle added -> first
// record -> second record in a different ISO week. Count and % surviving
// each step, per weekly signup cohort."
//
// "Verified": there is no email/phone verification flow an end-user
// actually goes through in this codebase (src/lib/auth/provider.ts is an
// unwired OAuth abstraction; User.emailVerifiedAt/emailVerifiedSource exist,
// but the only code path that ever sets them is an admin's manual
// ACCT-05 override — VerificationSource.SELF is defined in the schema but no
// self-serve flow ever writes it). So "verified" is dropped as a funnel step
// and replaced with the closest real proxy for "onboarded": has at least one
// AccountProfile row (created once the app's onboarding flow picks
// Owner/Mechanic). This is a deliberate substitution, stated here and in the
// page, not a silent rename.

export type FunnelCohortRow = {
  weekKey: string;
  weekStart: Date;
  signups: number;
  onboarded: number;
  garageCreated: number;
  vehicleAdded: number;
  firstRecord: number;
  secondRecordDifferentWeek: number;
};

export async function getSignupFunnelByCohort(): Promise<FunnelCohortRow[]> {
  const [accounts, garageCreatedIds, vehicleAddedIds, recordTimestamps] = await Promise.all([
    prisma.account.findMany({
      where: { deletedAt: null },
      select: { id: true, createdAt: true, _count: { select: { profiles: true } } },
    }),
    prisma.account
      .findMany({ where: { garagesOwned: { some: {} } }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id))),
    // "Vehicle added" = they personally added a vehicle to a garage they own
    // (the natural next funnel step after "garage created"), not merely
    // holding a membership on someone else's vehicle — see definitions.ts
    // header note on this file's scope.
    prisma.account
      .findMany({ where: { garagesOwned: { some: { vehicles: { some: {} } } } }, select: { id: true } })
      .then((rows) => new Set(rows.map((r) => r.id))),
    getAccountRecordTimestamps(),
  ]);

  type Bucket = FunnelCohortRow & { _weekStart: Date };
  const buckets = new Map<string, Bucket>();

  for (const account of accounts) {
    const key = isoWeekKey(account.createdAt);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        weekKey: key,
        weekStart: weekStart(account.createdAt),
        _weekStart: weekStart(account.createdAt),
        signups: 0,
        onboarded: 0,
        garageCreated: 0,
        vehicleAdded: 0,
        firstRecord: 0,
        secondRecordDifferentWeek: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.signups += 1;
    if (account._count.profiles > 0) bucket.onboarded += 1;
    if (garageCreatedIds.has(account.id)) bucket.garageCreated += 1;
    if (vehicleAddedIds.has(account.id)) bucket.vehicleAdded += 1;

    const timestamps = recordTimestamps.get(account.id) ?? [];
    if (timestamps.length >= 1) bucket.firstRecord += 1;
    // Literal reading of "second record in a different ISO week": the
    // account's 2nd record ever (by time) falls in a different ISO week
    // than its 1st — not merely "has activity across 2 distinct weeks ever".
    if (timestamps.length >= 2 && isoWeekKey(timestamps[1]) !== isoWeekKey(timestamps[0])) {
      bucket.secondRecordDifferentWeek += 1;
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b._weekStart.getTime() - a._weekStart.getTime())
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it from the returned row
    .map(({ _weekStart, ...row }) => row);
}
