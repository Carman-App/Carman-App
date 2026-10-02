import "server-only";
import { prisma } from "@/lib/prisma";
import { PlanSubject, SubscriptionEventType, SubscriptionStatus } from "@/generated/prisma/enums";
import type { Plan } from "@/generated/prisma/client";
import { cached, invalidate } from "@/lib/redis";

/**
 * Plan limit enforcement lives here, in the domain layer — not in the UI.
 * Usage itself is not a stored counter table; it's computed on demand from
 * real rows so it can never drift from reality.
 *
 * Product rules (Product overview §06):
 * - A new account (or workshop) gets everything unlocked for a trial with no
 *   card: the first time its plan is looked up, a TRIALING subscription on
 *   the top plan is started, for SubscriptionRules.trialDays (CFG-08).
 * - When the trial ends without a paid plan, the account falls back to the
 *   FREE plan of its side. Records stay readable; only adding beyond the
 *   free limits is gated (a write that would exceed them gets a 402).
 * - A past-due subscription keeps its plan until its grace window ends.
 */

export class PlanLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitExceededError";
  }
}

export const PLAN_CODES = {
  OWNER_FREE: "OWNER_FREE",
  OWNER_PERSONAL: "OWNER_PERSONAL",
  OWNER_PRO: "OWNER_PRO",
  WORKSHOP_FREE: "WORKSHOP_FREE",
  WORKSHOP_STANDARD: "WORKSHOP_STANDARD",
  WORKSHOP_FLEET: "WORKSHOP_FLEET",
} as const;

const FREE_PLAN: Record<PlanSubject, string> = {
  [PlanSubject.OWNER]: PLAN_CODES.OWNER_FREE,
  [PlanSubject.WORKSHOP]: PLAN_CODES.WORKSHOP_FREE,
};

/** The plan a trial runs on: everything unlocked. */
const TRIAL_PLAN: Record<PlanSubject, string> = {
  [PlanSubject.OWNER]: PLAN_CODES.OWNER_PRO,
  [PlanSubject.WORKSHOP]: PLAN_CODES.WORKSHOP_FLEET,
};

export type PlanState = {
  plan: Plan;
  /** trial: inside the no-card trial · active: paid · grace: payment failed, still inside grace · free: no paid plan */
  state: "trial" | "active" | "grace" | "free";
  trialEndsAt: Date | null;
  subscriptionId: string | null;
};

function subjectWhere(subject: PlanSubject, id: string) {
  return subject === PlanSubject.OWNER ? { accountId: id } : { workshopId: id };
}

async function startTrial(subject: PlanSubject, id: string): Promise<PlanState | null> {
  const plan = await prisma.plan.findUnique({ where: { code: TRIAL_PLAN[subject] } });
  if (!plan) return null;
  const rules = await prisma.subscriptionRules.findUnique({ where: { key: "global" } });
  const trialDays = plan.trialDays ?? rules?.trialDays ?? 14;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 86_400_000);

  const subscription = await prisma.$transaction(async (tx) => {
    // Two first requests can race; whichever lands second reuses the first trial.
    const existing = await tx.subscription.findFirst({ where: { ...subjectWhere(subject, id), subject } });
    if (existing) return existing;
    const created = await tx.subscription.create({
      data: { ...subjectWhere(subject, id), subject, planId: plan.id, status: SubscriptionStatus.TRIALING, trialStartedAt: now, trialEndsAt },
    });
    await tx.subscriptionEvent.create({
      data: { subscriptionId: created.id, type: SubscriptionEventType.STARTED, toPlanId: plan.id, note: `Trial started at sign-up (${trialDays} days)` },
    });
    return created;
  });
  return { plan, state: "trial", trialEndsAt: subscription.trialEndsAt, subscriptionId: subscription.id };
}

/**
 * The plan in force for an account (owner side) or a workshop right now.
 * Returns null only when plans have not been seeded, in which case nothing
 * is enforced (a fresh dev database behaves as before).
 */
async function loadPlanState(subject: PlanSubject, id: string): Promise<PlanState | null> {
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: { ...subjectWhere(subject, id), subject },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) return startTrial(subject, id);

  const { status, plan, trialEndsAt, graceEndsAt } = subscription;
  if (status === SubscriptionStatus.ACTIVE) return { plan, state: "active", trialEndsAt: null, subscriptionId: subscription.id };
  if (status === SubscriptionStatus.TRIALING && (!trialEndsAt || trialEndsAt > now)) {
    return { plan, state: "trial", trialEndsAt, subscriptionId: subscription.id };
  }
  if (status === SubscriptionStatus.PAST_DUE && graceEndsAt && graceEndsAt > now) {
    return { plan, state: "grace", trialEndsAt: null, subscriptionId: subscription.id };
  }

  const free = await prisma.plan.findUnique({ where: { code: FREE_PLAN[subject] } });
  if (!free) return null;
  return { plan: free, state: "free", trialEndsAt: trialEndsAt ?? null, subscriptionId: subscription.id };
}

const planKey = (subject: PlanSubject, id: string) => `plan:${subject}:${id}`;

/**
 * Cached for a minute: every write checks the plan, and the plan changes
 * rarely. Anything that changes a subscription calls invalidatePlanState.
 */
export async function getPlanState(subject: PlanSubject, id: string): Promise<PlanState | null> {
  const value = await cached(planKey(subject, id), 60, () => loadPlanState(subject, id));
  if (!value) return null;
  // JSON round-trip through the cache turns dates into strings.
  return {
    ...value,
    trialEndsAt: value.trialEndsAt ? new Date(value.trialEndsAt) : null,
    plan: { ...value.plan, createdAt: new Date(value.plan.createdAt) },
  };
}

export async function invalidatePlanState(subject: PlanSubject, id: string): Promise<void> {
  await invalidate(planKey(subject, id));
}

/** Drops the cached plan for whoever a subscription belongs to. Call after changing it. */
export async function invalidatePlanForSubscription(sub: { subject: PlanSubject; accountId: string | null; workshopId: string | null }): Promise<void> {
  const id = sub.subject === PlanSubject.OWNER ? sub.accountId : sub.workshopId;
  if (id) await invalidatePlanState(sub.subject, id);
}

const planLabel = (s: PlanState) => (s.state === "trial" ? `${s.plan.name} trial` : `${s.plan.name} plan`);

/** Throws PlanLimitExceededError if creating another garage would exceed the account's plan. */
export async function assertCanCreateGarage(accountId: string): Promise<void> {
  const ps = await getPlanState(PlanSubject.OWNER, accountId);
  const max = ps?.plan.maxGarages;
  if (!ps || max == null) return;

  const count = await prisma.garage.count({ where: { ownerId: accountId } });
  if (count >= max) {
    throw new PlanLimitExceededError(`The ${planLabel(ps)} allows ${max} garage${max === 1 ? "" : "s"}; this account already has ${count}.`);
  }
}

/** Throws PlanLimitExceededError if adding another vehicle to a garage would exceed the owning account's plan. */
export async function assertCanCreateVehicle(garageId: string): Promise<void> {
  const garage = await prisma.garage.findUnique({ where: { id: garageId }, select: { ownerId: true } });
  if (!garage) return;

  const ps = await getPlanState(PlanSubject.OWNER, garage.ownerId);
  const max = ps?.plan.maxVehicles;
  if (!ps || max == null) return;

  const count = await prisma.vehicle.count({ where: { garage: { ownerId: garage.ownerId } } });
  if (count >= max) {
    throw new PlanLimitExceededError(`The ${planLabel(ps)} allows ${max} vehicle${max === 1 ? "" : "s"}; this account already has ${count}.`);
  }
}

/**
 * Throws PlanLimitExceededError if a garage has no free seat. Seats are per
 * garage and counted against the owner's plan: current members plus pending
 * invitations (an invitation holds a seat until it is answered or expires).
 */
export async function assertCanAddGarageSeat(garageId: string): Promise<void> {
  const garage = await prisma.garage.findUnique({ where: { id: garageId }, select: { ownerId: true } });
  if (!garage) return;

  const ps = await getPlanState(PlanSubject.OWNER, garage.ownerId);
  const max = ps?.plan.maxSeats;
  if (!ps || max == null) return;

  const [members, pending] = await Promise.all([
    prisma.garageMember.count({ where: { garageId } }),
    prisma.garageInvitation.count({ where: { garageId, status: "PENDING", expiresAt: { gt: new Date() } } }),
  ]);
  if (members + pending >= max) {
    throw new PlanLimitExceededError(
      max === 1
        ? `The ${planLabel(ps)} is for one person; upgrade to share this garage.`
        : `The ${planLabel(ps)} allows ${max} people per garage; ${members} member${members === 1 ? "" : "s"} and ${pending} pending invitation${pending === 1 ? "" : "s"} already hold every seat.`,
    );
  }
}

/** Throws PlanLimitExceededError if a workshop has hit its plan's jobs-per-month cap. */
export async function assertCanCreateJob(workshopId: string): Promise<void> {
  const ps = await getPlanState(PlanSubject.WORKSHOP, workshopId);
  const max = ps?.plan.maxJobsPerMonth;
  if (!ps || max == null) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.job.count({ where: { workshopId, createdAt: { gte: startOfMonth } } });
  if (count >= max) {
    throw new PlanLimitExceededError(`The ${planLabel(ps)} allows ${max} jobs a month; this workshop has opened ${count} this month.`);
  }
}

/** Throws PlanLimitExceededError if a workshop has hit its plan's staff cap. */
export async function assertCanAddWorkshopStaff(workshopId: string): Promise<void> {
  const ps = await getPlanState(PlanSubject.WORKSHOP, workshopId);
  const max = ps?.plan.maxStaff;
  if (!ps || max == null) return;

  const count = await prisma.workshopMember.count({ where: { workshopId } });
  if (count >= max) {
    throw new PlanLimitExceededError(`The ${planLabel(ps)} allows ${max} staff; this workshop already has ${count}.`);
  }
}
