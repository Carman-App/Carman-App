import "server-only";
import { prisma } from "@/lib/prisma";
import { invalidatePlanForSubscription, PLAN_CODES } from "@/lib/limits";
import { notify } from "@/lib/notifications/provider";
import { NotificationType, PlanSubject, SubscriptionEventType, SubscriptionStatus } from "@/generated/prisma/enums";
import type { Plan, Prisma } from "@/generated/prisma/client";

/**
 * In-app subscriptions (App Store / Google Play), through RevenueCat.
 *
 * The app buys with RevenueCat's SDK, signed in to RevenueCat as the Carma
 * account id. The server never trusts the app about what was bought: after a
 * purchase the app calls POST /api/v1/billing/sync, and RevenueCat's webhook
 * (POST /api/v1/billing/revenuecat) triggers the same sync on renewals,
 * cancellations, billing problems and refunds. Either way this module reads
 * the account's purchases from RevenueCat's REST API and brings the
 * Subscription rows in line, so it is safe to run any number of times and
 * in any order.
 *
 * Which product buys which plan: Plan.storeProductIds (seeded; editable in
 * the console). Owner plans apply to the account, workshop plans to the
 * workshop the account owns.
 */

export class StoreBillingNotConfiguredError extends Error {
  constructor() {
    super("In-app purchases are not set up on this server (REVENUECAT_SECRET_API_KEY).");
    this.name = "StoreBillingNotConfiguredError";
  }
}

type RcSubscription = {
  expires_date: string | null;
  purchase_date?: string;
  period_type?: "normal" | "trial" | "intro" | "prepaid";
  store?: string;
  is_sandbox?: boolean;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  grace_period_expires_date?: string | null;
  refunded_at?: string | null;
  price?: { amount: number; currency: string } | null;
};

type RcSubscriber = { subscriber: { subscriptions?: Record<string, RcSubscription> } };

export function storeBillingConfigured(): boolean {
  return Boolean(process.env.REVENUECAT_SECRET_API_KEY);
}

async function fetchSubscriber(appUserId: string): Promise<RcSubscriber> {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) throw new StoreBillingNotConfiguredError();
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}: ${await res.text().catch(() => "")}`.trim());
  return (await res.json()) as RcSubscriber;
}

const ORDER: string[] = Object.values(PLAN_CODES);
/** Higher = more capable. Seeded plans by their tier; any other plan by price. */
const rank = (p: Plan) => (ORDER.includes(p.code) ? ORDER.indexOf(p.code) % 3 : 0) * 1_000_000 + p.priceCents;

function matchPlan(plans: Plan[], productId: string): Plan | undefined {
  const base = productId.split(":")[0];
  return plans.find((p) => p.storeProductIds.includes(productId) || p.storeProductIds.includes(base));
}

type Purchase = { plan: Plan; productId: string; sub: RcSubscription };

/** The best purchase still in force for each side of the product. */
function activePurchases(plans: Plan[], subs: Record<string, RcSubscription>, now: Date): Map<PlanSubject, Purchase> {
  const best = new Map<PlanSubject, Purchase>();
  for (const [productId, sub] of Object.entries(subs)) {
    if (sub.refunded_at) continue;
    const plan = matchPlan(plans, productId);
    if (!plan) continue;
    const until = sub.expires_date ? new Date(sub.expires_date) : null;
    const grace = sub.grace_period_expires_date ? new Date(sub.grace_period_expires_date) : null;
    const inForce = !until || until > now || (grace !== null && grace > now);
    if (!inForce) continue;
    const current = best.get(plan.subject);
    if (!current || rank(plan) > rank(current.plan)) best.set(plan.subject, { plan, productId, sub });
  }
  return best;
}

const toDate = (s: string | null | undefined) => (s ? new Date(s) : null);

async function applyPurchase(subject: PlanSubject, ownerId: string, purchase: Purchase | null, accountId: string, now: Date) {
  const where = subject === PlanSubject.OWNER ? { accountId: ownerId } : { workshopId: ownerId };
  const changed = await prisma.$transaction(async (tx) => {
    // One sync at a time per subscription owner (the webhook and the app can race).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing:${subject}:${ownerId}`}))`;
    const existing = await tx.subscription.findFirst({ where: { ...where, subject }, include: { plan: true }, orderBy: { createdAt: "desc" } });

    if (!purchase) {
      // Only end what the store sold; plans set from the console stay.
      if (!existing?.store || existing.status === SubscriptionStatus.CANCELED || existing.status === SubscriptionStatus.TRIALING) return null;
      await tx.subscription.update({
        where: { id: existing.id },
        data: { status: SubscriptionStatus.CANCELED, cancelledAt: existing.cancelledAt ?? now, willRenew: false, graceEndsAt: null },
      });
      await tx.subscriptionEvent.create({
        data: { subscriptionId: existing.id, type: SubscriptionEventType.CANCELLED, fromPlanId: existing.planId, note: "Store subscription ended" },
      });
      return { sub: existing, paymentFailed: false };
    }

    const { plan, productId, sub } = purchase;
    const expires = toDate(sub.expires_date);
    const grace = toDate(sub.grace_period_expires_date);
    const billingIssue = Boolean(sub.billing_issues_detected_at) && (!expires || expires <= now);
    const status = billingIssue && grace && grace > now ? SubscriptionStatus.PAST_DUE : SubscriptionStatus.ACTIVE;
    const willRenew = !sub.unsubscribe_detected_at;
    const price = sub.price ? { lockedPriceCents: Math.round(sub.price.amount * 100), lockedCurrency: sub.price.currency } : {};
    const data = {
      planId: plan.id,
      status,
      currentPeriodEnd: expires,
      graceEndsAt: status === SubscriptionStatus.PAST_DUE ? grace : null,
      store: sub.store?.toUpperCase() ?? "STORE",
      storeProductId: productId,
      willRenew,
      cancelledAt: willRenew ? null : (existing?.cancelledAt ?? toDate(sub.unsubscribe_detected_at) ?? now),
      ...(sub.period_type === "trial" ? { trialEndsAt: expires } : {}),
    };
    const metadata = { productId, store: sub.store ?? null, sandbox: sub.is_sandbox ?? false } as Prisma.InputJsonValue;

    if (!existing) {
      const created = await tx.subscription.create({ data: { ...where, subject, ...data, ...price } });
      await tx.subscriptionEvent.create({ data: { subscriptionId: created.id, type: SubscriptionEventType.STARTED, toPlanId: plan.id, note: "Bought in the app", metadata } });
      return { sub: created, paymentFailed: status === SubscriptionStatus.PAST_DUE };
    }

    const events: { type: SubscriptionEventType; note: string }[] = [];
    const wasStore = Boolean(existing.store) && existing.status !== SubscriptionStatus.CANCELED;
    if (!wasStore) {
      events.push(
        existing.status === SubscriptionStatus.TRIALING
          ? { type: SubscriptionEventType.TRIAL_CONVERTED, note: "Bought in the app" }
          : existing.status === SubscriptionStatus.CANCELED
            ? { type: SubscriptionEventType.REACTIVATED, note: "Bought in the app" }
            : { type: SubscriptionEventType.STARTED, note: "Bought in the app" },
      );
    } else if (existing.planId !== plan.id) {
      events.push({ type: rank(plan) > rank(existing.plan) ? SubscriptionEventType.UPGRADED : SubscriptionEventType.DOWNGRADED, note: "Changed in the store" });
    }
    if (status === SubscriptionStatus.PAST_DUE && existing.status !== SubscriptionStatus.PAST_DUE) {
      events.push({ type: SubscriptionEventType.PAYMENT_FAILED, note: "The store could not take the renewal payment" });
    }
    if (wasStore && existing.willRenew !== false && !willRenew) events.push({ type: SubscriptionEventType.CANCELLED, note: "Auto-renew turned off; active until the period ends" });
    if (wasStore && existing.willRenew === false && willRenew) events.push({ type: SubscriptionEventType.REACTIVATED, note: "Auto-renew turned back on" });

    const samePrice = existing.planId === plan.id && existing.lockedPriceCents != null;
    await tx.subscription.update({ where: { id: existing.id }, data: { ...data, ...(samePrice ? {} : price) } });
    for (const e of events) {
      await tx.subscriptionEvent.create({
        data: { subscriptionId: existing.id, type: e.type, fromPlanId: existing.planId, toPlanId: plan.id, note: e.note, metadata },
      });
    }
    return { sub: existing, paymentFailed: events.some((e) => e.type === SubscriptionEventType.PAYMENT_FAILED) };
  });

  if (!changed) return;
  await invalidatePlanForSubscription(changed.sub);
  if (changed.paymentFailed) {
    await notify({
      accountId,
      type: NotificationType.GENERIC,
      title: "Your Carma payment didn't go through",
      body: "Update your payment details in the App Store or Google Play to keep your plan.",
      metadata: { route: "/settings/billing" },
    });
  }
}

/** Brings the account's (and its workshop's) subscriptions in line with the store. */
export async function syncStoreSubscriptions(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, workshopsOwned: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!account) return;

  const [{ subscriber }, plans] = await Promise.all([
    fetchSubscriber(accountId),
    prisma.plan.findMany({ where: { storeProductIds: { isEmpty: false } } }),
  ]);
  const now = new Date();
  const best = activePurchases(plans, subscriber.subscriptions ?? {}, now);

  await applyPurchase(PlanSubject.OWNER, account.id, best.get(PlanSubject.OWNER) ?? null, account.id, now);
  const workshop = account.workshopsOwned[0];
  if (workshop) await applyPurchase(PlanSubject.WORKSHOP, workshop.id, best.get(PlanSubject.WORKSHOP) ?? null, account.id, now);
}
