import "server-only";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, SubscriptionEventType } from "@/generated/prisma/enums";
import { currencyForSubscription, REPORTING_CURRENCY } from "./currency";
import { convertCentsToReportingCurrency, getFxRateMap } from "./fx";

// MON-01 — "MRR + subscriber counts by plan, month's movement split
// new/expansion/contraction/churn, active subs per plan, trials running."

const SUBSCRIPTION_INCLUDE = {
  plan: true,
  account: { select: { region: true } },
  workshop: { select: { owner: { select: { region: true } } } },
} as const;

export type PlanBreakdownRow = {
  planId: string;
  planName: string;
  planCode: string;
  count: number;
};

export type MrrByCurrency = {
  currency: string;
  grossCents: number;
  convertedCents: number | null; // null if no FxRate for this currency
};

export type MrrSnapshot = {
  /** Billing subjects counted toward MRR: ACTIVE and PAST_DUE (still owed, not yet churned). */
  mrrByCurrency: MrrByCurrency[];
  totalReportingCents: number; // sum of every convertible currency's convertedCents
  unconvertedCurrencies: string[]; // currencies present but missing an FxRate — excluded from totalReportingCents
  subscriberCountsByPlan: PlanBreakdownRow[]; // ACTIVE + TRIALING + PAST_DUE, "subscriber counts by plan"
  activeSubsByPlan: PlanBreakdownRow[]; // ACTIVE only, "active subs per plan"
  trialsRunning: number; // status = TRIALING
  trialsRunningLegacy: number; // subset of the above with trialStartedAt still null (pre-dates that field)
};

export async function getMrrSnapshot(): Promise<MrrSnapshot> {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING] } },
    include: SUBSCRIPTION_INCLUDE,
  });
  const rates = await getFxRateMap();

  const billed = subs.filter((s) => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.PAST_DUE);

  const grossByCurrency = new Map<string, number>();
  for (const s of billed) {
    const currency = currencyForSubscription(s);
    grossByCurrency.set(currency, (grossByCurrency.get(currency) ?? 0) + s.plan.priceCents);
  }

  const mrrByCurrency: MrrByCurrency[] = [];
  const unconvertedCurrencies: string[] = [];
  let totalReportingCents = 0;
  for (const [currency, grossCents] of grossByCurrency) {
    const convertedCents = convertCentsToReportingCurrency(grossCents, currency, rates);
    mrrByCurrency.push({ currency, grossCents, convertedCents });
    if (convertedCents == null) unconvertedCurrencies.push(currency);
    else totalReportingCents += convertedCents;
  }
  mrrByCurrency.sort((a, b) => b.grossCents - a.grossCents);

  function breakdownByPlan(rows: typeof subs): PlanBreakdownRow[] {
    const map = new Map<string, PlanBreakdownRow>();
    for (const s of rows) {
      const existing = map.get(s.planId);
      if (existing) existing.count += 1;
      else map.set(s.planId, { planId: s.planId, planName: s.plan.name, planCode: s.plan.code, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  const trialing = subs.filter((s) => s.status === SubscriptionStatus.TRIALING);

  return {
    mrrByCurrency,
    totalReportingCents,
    unconvertedCurrencies,
    subscriberCountsByPlan: breakdownByPlan(subs),
    activeSubsByPlan: breakdownByPlan(subs.filter((s) => s.status === SubscriptionStatus.ACTIVE)),
    trialsRunning: trialing.length,
    trialsRunningLegacy: trialing.filter((s) => s.trialStartedAt == null).length,
  };
}

// --- Monthly movement (new / expansion / contraction / churn / reactivation) ---

export type MovementBucket = { count: number; mrrDeltaReportingCents: number };
export type MonthlyMovement = {
  monthStart: Date;
  monthEnd: Date;
  new_: MovementBucket;
  expansion: MovementBucket;
  contraction: MovementBucket;
  churn: MovementBucket;
  reactivation: MovementBucket;
  netReportingCentsChange: number;
};

/** Start (inclusive) and end (exclusive) instants for the calendar month containing `d`, in UTC. */
export function monthBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getMonthlyMovement(referenceDate: Date): Promise<MonthlyMovement> {
  const { start, end } = monthBounds(referenceDate);
  const rates = await getFxRateMap();

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      occurredAt: { gte: start, lt: end },
      type: {
        in: [
          SubscriptionEventType.STARTED,
          SubscriptionEventType.TRIAL_CONVERTED,
          SubscriptionEventType.UPGRADED,
          SubscriptionEventType.DOWNGRADED,
          SubscriptionEventType.CANCELLED,
          SubscriptionEventType.REACTIVATED,
        ],
      },
    },
    include: {
      subscription: { include: SUBSCRIPTION_INCLUDE },
    },
  });

  // fromPlanId/toPlanId are plain id columns on SubscriptionEvent (no
  // relation, matching this schema's "actor columns" convention), so their
  // prices are looked up separately rather than via `include`.
  const referencedPlanIds = [
    ...new Set(events.flatMap((e) => [e.fromPlanId, e.toPlanId]).filter((id): id is string => Boolean(id))),
  ];
  const referencedPlans = referencedPlanIds.length
    ? await prisma.plan.findMany({ where: { id: { in: referencedPlanIds } }, select: { id: true, priceCents: true } })
    : [];
  const planPriceById = new Map(referencedPlans.map((p) => [p.id, p.priceCents]));

  const empty = (): MovementBucket => ({ count: 0, mrrDeltaReportingCents: 0 });
  const buckets = { new_: empty(), expansion: empty(), contraction: empty(), churn: empty(), reactivation: empty() };

  for (const e of events) {
    const currency = currencyForSubscription(e.subscription);
    const toPriceCents = e.toPlanId ? (planPriceById.get(e.toPlanId) ?? e.subscription.plan.priceCents) : e.subscription.plan.priceCents;
    const fromPriceCents = e.fromPlanId ? (planPriceById.get(e.fromPlanId) ?? 0) : 0;
    // Prefer the event's own recorded amountCents; fall back to plan list
    // prices for event types where that's a faithful stand-in.
    const amountCents =
      e.amountCents ??
      (e.type === SubscriptionEventType.STARTED || e.type === SubscriptionEventType.TRIAL_CONVERTED
        ? e.subscription.plan.priceCents
        : e.type === SubscriptionEventType.UPGRADED
          ? toPriceCents - fromPriceCents
          : e.type === SubscriptionEventType.DOWNGRADED
            ? fromPriceCents - toPriceCents
            : e.type === SubscriptionEventType.CANCELLED
              ? e.subscription.plan.priceCents
              : e.subscription.plan.priceCents);
    const converted = convertCentsToReportingCurrency(Math.abs(amountCents), currency, rates) ?? 0;
    const signed = e.type === SubscriptionEventType.DOWNGRADED || e.type === SubscriptionEventType.CANCELLED ? -converted : converted;

    switch (e.type) {
      case SubscriptionEventType.STARTED:
      case SubscriptionEventType.TRIAL_CONVERTED:
        buckets.new_.count += 1;
        buckets.new_.mrrDeltaReportingCents += converted;
        break;
      case SubscriptionEventType.UPGRADED:
        buckets.expansion.count += 1;
        buckets.expansion.mrrDeltaReportingCents += converted;
        break;
      case SubscriptionEventType.DOWNGRADED:
        buckets.contraction.count += 1;
        buckets.contraction.mrrDeltaReportingCents += signed;
        break;
      case SubscriptionEventType.CANCELLED:
        buckets.churn.count += 1;
        buckets.churn.mrrDeltaReportingCents += signed;
        break;
      case SubscriptionEventType.REACTIVATED:
        buckets.reactivation.count += 1;
        buckets.reactivation.mrrDeltaReportingCents += converted;
        break;
    }
  }

  const netReportingCentsChange =
    buckets.new_.mrrDeltaReportingCents +
    buckets.expansion.mrrDeltaReportingCents +
    buckets.contraction.mrrDeltaReportingCents +
    buckets.churn.mrrDeltaReportingCents +
    buckets.reactivation.mrrDeltaReportingCents;

  return { monthStart: start, monthEnd: end, ...buckets, netReportingCentsChange };
}

export { REPORTING_CURRENCY };
