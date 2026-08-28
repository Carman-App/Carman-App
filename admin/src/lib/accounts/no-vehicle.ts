import type { Prisma } from "@/generated/prisma/client";
import { Region } from "@/generated/prisma/enums";

// ACCT-04: "accounts that signed up and never added a vehicle" — shared
// between the /accounts/no-vehicle page and its CSV export route so the two
// can never drift apart on what counts as a match.
export type NoVehicleFilters = {
  /** Only accounts created at least this many days ago. */
  minAgeDays?: number;
  region?: Region;
  /** Include accounts already marked as chased (default: exclude them so the list only shows work left to do). */
  includeChased?: boolean;
};

export function buildNoVehicleWhere(filters: NoVehicleFilters): Prisma.AccountWhereInput {
  const where: Prisma.AccountWhereInput = {
    deletedAt: null,
    mergedIntoAccountId: null,
    // No vehicle anywhere they can reach: every garage they OWN has zero
    // vehicles (vacuously true if they own none), and they hold no
    // vehicle-level membership on someone else's vehicle either.
    garagesOwned: { every: { vehicles: { none: {} } } },
    vehicleMemberships: { none: {} },
  };

  if (filters.minAgeDays && filters.minAgeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.minAgeDays);
    where.createdAt = { lte: cutoff };
  }

  if (filters.region) {
    where.region = filters.region;
  }

  if (!filters.includeChased) {
    where.chasedNoVehicleAt = null;
  }

  return where;
}
