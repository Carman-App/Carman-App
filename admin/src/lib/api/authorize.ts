import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/api/auth";
import { GarageRole, type WorkshopRole } from "@/generated/prisma/enums";

/**
 * Resource-authorization helpers shared by /api/v1/* routes. Each function
 * throws ForbiddenError (mapped to a 403 by the route) when the calling
 * account doesn't have the relationship it claims.
 */

export async function requireGarageMembership(accountId: string, garageId: string) {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: {
      ownerId: true,
      members: { where: { accountId }, select: { id: true } },
    },
  });
  if (!garage) throw new ForbiddenError("Garage not found.");
  const isMember = garage.ownerId === accountId || garage.members.length > 0;
  if (!isMember) throw new ForbiddenError("Not a member of this garage.");
  return garage;
}

/**
 * Stricter than requireGarageMembership: the calling account must be the
 * garage's actual owner, or a GarageMember with role OWNER (shared
 * ownership). Used for destructive/administrative actions — deleting a
 * garage, managing members, sending invitations.
 */
export async function requireGarageOwner(accountId: string, garageId: string) {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
    select: {
      ownerId: true,
      members: { where: { accountId }, select: { id: true, role: true } },
    },
  });
  if (!garage) throw new ForbiddenError("Garage not found.");

  const member = garage.members[0];
  const isOwner = garage.ownerId === accountId || member?.role === GarageRole.OWNER;
  if (!isOwner) throw new ForbiddenError("Only the garage owner can do this.");
  return garage;
}

/** Owner-level access to a vehicle, via its garage's ownership. */
export async function requireVehicleOwnerAccess(accountId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { garageId: true },
  });
  if (!vehicle) throw new ForbiddenError("Vehicle not found.");
  await requireGarageOwner(accountId, vehicle.garageId);
  return vehicle;
}

export async function requireVehicleAccess(accountId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      garageId: true,
      garage: {
        select: {
          ownerId: true,
          members: { where: { accountId }, select: { id: true } },
        },
      },
      memberships: { where: { accountId }, select: { id: true } },
    },
  });
  if (!vehicle) throw new ForbiddenError("Vehicle not found.");

  const hasAccess =
    vehicle.garage.ownerId === accountId ||
    vehicle.garage.members.length > 0 ||
    vehicle.memberships.length > 0;

  if (!hasAccess) throw new ForbiddenError("No access to this vehicle.");
  return vehicle;
}

export async function requireWorkshopRole(
  accountId: string,
  workshopId: string,
  allowedRoles: WorkshopRole[],
) {
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      ownerId: true,
      members: { where: { accountId }, select: { role: true } },
    },
  });
  if (!workshop) throw new ForbiddenError("Workshop not found.");

  if (workshop.ownerId === accountId) return { role: "OWNER" as const };

  const member = workshop.members[0];
  if (!member || !allowedRoles.includes(member.role)) {
    throw new ForbiddenError("Not permitted to do this for this workshop.");
  }
  return { role: member.role };
}

/**
 * Consent gate for a workshop touching a Carma-linked vehicle's records.
 * Product spec: "If customer is NOT on Carma: nothing shared... workshop
 * only sees a customer's history while access is actively granted" — a
 * workshop must hold a live (unrevoked, unexpired) AccessGrant for a
 * specific vehicle before it may link work to that vehicle at all. This is
 * the enforcement point that keeps Carma from being "an owner-dashboard for
 * workshops": knowing a vehicle's id is not enough.
 *
 * Only applies when a workshop is linking to a real Vehicle row — jobs
 * against a freeform (non-Carma) vehicleDescription never reach this check.
 */
export async function requireLiveAccessGrant(workshopId: string, vehicleId: string) {
  const grant = await prisma.accessGrant.findFirst({
    where: {
      workshopId,
      vehicleId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!grant) {
    throw new ForbiddenError(
      "This workshop does not have an active, unexpired access grant for this vehicle.",
    );
  }
  return grant;
}

/** Any membership (owner or any staff role) — for read-only workshop endpoints. */
export async function requireWorkshopMembership(accountId: string, workshopId: string) {
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      ownerId: true,
      members: { where: { accountId }, select: { role: true } },
    },
  });
  if (!workshop) throw new ForbiddenError("Workshop not found.");

  const isMember = workshop.ownerId === accountId || workshop.members.length > 0;
  if (!isMember) throw new ForbiddenError("Not a member of this workshop.");
  return workshop;
}
