import "server-only";
import { prisma } from "@/lib/prisma";
import { SubscriptionEventType } from "@/generated/prisma/enums";

/**
 * SubscriptionEvent is a brand-new append-only table (MON-01/02/05/08) and
 * starts completely empty — nothing has ever written to it. Per AGENTS.md's
 * brief for this work: "you must (a) backfill it: on load of your MRR page
 * ... synthesize STARTED events for existing subscriptions from their
 * createdAt if no event exists yet, so the dashboards aren't empty on day
 * one ... and (b) going forward, every real action ... must write a real
 * event."
 *
 * This backfill is intentionally narrow: it only ever synthesizes a STARTED
 * event, using the subscription's own real `createdAt` (never a fabricated
 * date), and only for subscriptions that have no event at all yet. It never
 * invents TRIAL_CONVERTED/UPGRADED/DOWNGRADED/CANCELLED events, because
 * those would require guessing *when* something changed pre-dating this
 * table — the honest move is to leave that history absent and say so in the
 * UI, rather than reconstruct dates nobody recorded. `idempotent`: re-running
 * this is always safe because the `events: { none: {} }` filter naturally
 * excludes subscriptions already backfilled (or that already have a real
 * event of any kind).
 */
export async function backfillStartedSubscriptionEvents(): Promise<number> {
  const unbackfilled = await prisma.subscription.findMany({
    where: { events: { none: {} } },
    select: { id: true, planId: true, createdAt: true },
  });
  if (unbackfilled.length === 0) return 0;

  await prisma.subscriptionEvent.createMany({
    data: unbackfilled.map((sub) => ({
      subscriptionId: sub.id,
      type: SubscriptionEventType.STARTED,
      toPlanId: sub.planId,
      occurredAt: sub.createdAt,
      note: "Backfilled — this subscription was created before SubscriptionEvent tracking began; occurredAt is the real Subscription.createdAt, not a guess.",
      performedByAdminId: null,
    })),
  });
  return unbackfilled.length;
}
