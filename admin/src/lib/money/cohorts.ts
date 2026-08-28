import "server-only";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, SubscriptionEventType } from "@/generated/prisma/enums";

// MON-02 — "trial conversion by cohort (started per week, converted/lapsed/
// still running, median days to conversion)".
//
// Conversion is identified via a real SubscriptionEvent(type=TRIAL_CONVERTED)
// row rather than inferred from current `status`, because status alone can't
// distinguish "converted, still paying" from "converted, later churned" from
// "never converted". SubscriptionEvent starts empty and is only backfilled
// with STARTED events (see ./events.ts) — TRIAL_CONVERTED is never
// backfilled, since we have no real record of *when* any pre-existing
// subscription converted. That means cohorts whose trial predates this
// feature will show 0 converted even if they're actually ACTIVE today; the
// UI states this plainly rather than guessing a conversion date.

function isoWeekKey(d: Date): string {
  // ISO week (Mon-start), matching common cohort-reporting convention.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function weekStart(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 1); // back to Monday
  return date;
}

export type TrialCohortRow = {
  weekKey: string; // "legacy" for subscriptions with no trialStartedAt on file
  weekStart: Date | null;
  started: number;
  converted: number;
  lapsed: number;
  stillRunning: number;
  medianDaysToConversion: number | null; // null if fewer than 1 conversion had a usable trialStartedAt
};

export async function getTrialCohorts(): Promise<TrialCohortRow[]> {
  // Population: any subscription that plausibly went through a trial —
  // it has a trialEndsAt on file, currently sits in TRIALING, or has a
  // recorded trialStartedAt. Straight-to-paid subscriptions (never trialed)
  // are excluded.
  const subs = await prisma.subscription.findMany({
    where: {
      OR: [{ trialStartedAt: { not: null } }, { trialEndsAt: { not: null } }, { status: SubscriptionStatus.TRIALING }],
    },
    select: { id: true, status: true, trialStartedAt: true },
  });
  if (subs.length === 0) return [];

  const conversions = await prisma.subscriptionEvent.findMany({
    where: { subscriptionId: { in: subs.map((s) => s.id) }, type: SubscriptionEventType.TRIAL_CONVERTED },
    select: { subscriptionId: true, occurredAt: true },
  });
  const conversionBySubId = new Map(conversions.map((c) => [c.subscriptionId, c.occurredAt]));

  type Bucket = {
    weekKey: string;
    weekStart: Date | null;
    started: number;
    converted: number;
    lapsed: number;
    stillRunning: number;
    conversionDaysSamples: number[];
  };
  const buckets = new Map<string, Bucket>();

  for (const s of subs) {
    const key = s.trialStartedAt ? isoWeekKey(s.trialStartedAt) : "legacy";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        weekKey: key,
        weekStart: s.trialStartedAt ? weekStart(s.trialStartedAt) : null,
        started: 0,
        converted: 0,
        lapsed: 0,
        stillRunning: 0,
        conversionDaysSamples: [],
      };
      buckets.set(key, bucket);
    }
    bucket.started += 1;

    const convertedAt = conversionBySubId.get(s.id);
    if (convertedAt) {
      bucket.converted += 1;
      if (s.trialStartedAt) {
        const days = (convertedAt.getTime() - s.trialStartedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) bucket.conversionDaysSamples.push(days);
      }
    } else if (s.status === SubscriptionStatus.TRIALING) {
      bucket.stillRunning += 1;
    } else if (s.status === SubscriptionStatus.CANCELED) {
      bucket.lapsed += 1;
    }
    // ACTIVE/PAST_DUE with no TRIAL_CONVERTED event on file: presumably
    // converted before event-tracking began — not counted either way here,
    // rather than guessed; see module comment.
  }

  function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  return [...buckets.values()]
    .map((b) => ({
      weekKey: b.weekKey,
      weekStart: b.weekStart,
      started: b.started,
      converted: b.converted,
      lapsed: b.lapsed,
      stillRunning: b.stillRunning,
      medianDaysToConversion: median(b.conversionDaysSamples),
    }))
    .sort((a, b) => {
      if (a.weekKey === "legacy") return 1;
      if (b.weekKey === "legacy") return -1;
      return (b.weekStart?.getTime() ?? 0) - (a.weekStart?.getTime() ?? 0);
    });
}
