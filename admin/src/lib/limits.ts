import { prisma } from "@/lib/prisma";
import { InvitationStatus, PlanSubject, SubscriptionStatus } from "@/generated/prisma/enums";

/**
 * Plan limit enforcement lives here, in the domain layer — not in the UI.
 * Usage itself is not a stored counter table; it's computed on demand from
 * real rows so it can never drift from reality.
 */

export class PlanLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitExceededError";
  }
}

async function getActiveSubscription(subject: PlanSubject, id: string) {
  const where =
    subject === PlanSubject.OWNER ? { accountId: id } : { workshopId: id };

  return prisma.subscription.findFirst({
    where: {
      ...where,
      subject,
      status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Throws PlanLimitExceededError if creating another garage would exceed the account's plan. */
export async function assertCanCreateGarage(accountId: string): Promise<void> {
  const subscription = await getActiveSubscription(PlanSubject.OWNER, accountId);
  const maxGarages = subscription?.plan.maxGarages;
  if (maxGarages == null) return; // no subscription on file, or unlimited plan — nothing to enforce yet

  const garageCount = await prisma.garage.count({ where: { ownerId: accountId } });
  if (garageCount >= maxGarages) {
    throw new PlanLimitExceededError(
      `This account's plan allows up to ${maxGarages} garage(s); it already has ${garageCount}.`,
    );
  }
}

/** Throws PlanLimitExceededError if adding another vehicle to a garage would exceed the owning account's plan. */
export async function assertCanCreateVehicle(garageId: string): Promise<void> {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: { ownerId: true },
  });
  if (!garage) return;

  const subscription = await getActiveSubscription(PlanSubject.OWNER, garage.ownerId);
  const maxVehicles = subscription?.plan.maxVehicles;
  if (maxVehicles == null) return;

  const vehicleCount = await prisma.vehicle.count({
    where: { garage: { ownerId: garage.ownerId } },
  });
  if (vehicleCount >= maxVehicles) {
    throw new PlanLimitExceededError(
      `This account's plan allows up to ${maxVehicles} vehicle(s) across its garages; it already has ${vehicleCount}.`,
    );
  }
}

/**
 * Throws PlanLimitExceededError if adding another seat to a garage would
 * exceed the owning account's plan (Plan.maxSeats — FREE: 1, PERSONAL: 3,
 * PRO: 10 per garage per the product spec). A pending invitation counts
 * against the limit too ("Pending: invited but not yet joined, holds a seat
 * against the plan's limit") — only a declined/expired invitation or a
 * removed member frees the seat back up.
 */
export async function assertCanAddGarageSeat(garageId: string): Promise<void> {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: { ownerId: true },
  });
  if (!garage) return;

  const subscription = await getActiveSubscription(PlanSubject.OWNER, garage.ownerId);
  const maxSeats = subscription?.plan.maxSeats;
  if (maxSeats == null) return;

  const [memberCount, pendingInviteCount] = await Promise.all([
    prisma.garageMember.count({ where: { garageId, removedAt: null } }),
    prisma.garageInvitation.count({ where: { garageId, status: InvitationStatus.PENDING } }),
  ]);
  const seatsUsed = memberCount + pendingInviteCount;
  if (seatsUsed >= maxSeats) {
    throw new PlanLimitExceededError(
      `This garage's plan allows up to ${maxSeats} seat(s) (members plus pending invitations); it already has ${seatsUsed}.`,
    );
  }
}

/** Throws PlanLimitExceededError if a workshop has hit its plan's jobs-per-month cap. */
export async function assertCanCreateJob(workshopId: string): Promise<void> {
  const subscription = await getActiveSubscription(PlanSubject.WORKSHOP, workshopId);
  const maxJobsPerMonth = subscription?.plan.maxJobsPerMonth;
  if (maxJobsPerMonth == null) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const jobCount = await prisma.job.count({
    where: { workshopId, createdAt: { gte: startOfMonth } },
  });
  if (jobCount >= maxJobsPerMonth) {
    throw new PlanLimitExceededError(
      `This workshop's plan allows up to ${maxJobsPerMonth} job(s) per month; it already has ${jobCount} this month.`,
    );
  }
}

/** Throws PlanLimitExceededError if a workshop has hit its plan's staff cap. */
export async function assertCanAddWorkshopStaff(workshopId: string): Promise<void> {
  const subscription = await getActiveSubscription(PlanSubject.WORKSHOP, workshopId);
  const maxStaff = subscription?.plan.maxStaff;
  if (maxStaff == null) return;

  const staffCount = await prisma.workshopMember.count({ where: { workshopId } });
  if (staffCount >= maxStaff) {
    throw new PlanLimitExceededError(
      `This workshop's plan allows up to ${maxStaff} staff member(s); it already has ${staffCount}.`,
    );
  }
}
