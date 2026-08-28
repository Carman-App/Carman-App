import "server-only";
import { prisma } from "@/lib/prisma";
import { Region } from "@/generated/prisma/enums";
import { getRecordsCount } from "@/lib/records";

// GAR-05: duplicate-plate finder, scoped by country (an account's `region`
// is this schema's only country field — see src/lib/region.ts). `Vehicle`
// has no soft-delete column, so "non-deleted" just means every row in the
// table; noted here rather than filtering on a field that doesn't exist.

export type DuplicatePlateVehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  createdAt: Date; // used below as a "claim date" proxy — see note on DuplicatePlateGroup
  garageId: string;
  garageName: string;
  ownerAccountId: string;
  ownerName: string;
  recordCount: number;
};

export type DuplicatePlateGroup = {
  plate: string;
  region: Region;
  /**
   * There is no explicit "claimed this plate" event anywhere in the schema
   * (no PlateClaim table, no claimedAt column) — each vehicle's own
   * `createdAt` is used below as an honest proxy for "when this garage
   * first had this plate on file", not a real claim timestamp.
   */
  vehicles: DuplicatePlateVehicle[];
};

export async function findDuplicatePlates(): Promise<DuplicatePlateGroup[]> {
  const vehicles = await prisma.vehicle.findMany({
    include: { garage: { include: { owner: { include: { user: true } } } } },
  });

  // Group by (region, normalized plate) — normalize casing/whitespace since
  // real plates get typed inconsistently, but display each vehicle's plate
  // exactly as stored.
  const groups = new Map<string, typeof vehicles>();
  for (const v of vehicles) {
    const region = v.garage.owner.region;
    const key = `${region}::${v.plate.trim().toUpperCase()}`;
    const list = groups.get(key);
    if (list) list.push(v);
    else groups.set(key, [v]);
  }

  const duplicates: DuplicatePlateGroup[] = [];
  for (const list of groups.values()) {
    // Only a real collision if it spans more than one garage — the same
    // garage listing one plate on two rows isn't a duplicate-plate finding.
    const garageIds = new Set(list.map((v) => v.garageId));
    if (list.length < 2 || garageIds.size < 2) continue;

    const recordCounts = await Promise.all(list.map((v) => getRecordsCount(v.id)));
    duplicates.push({
      plate: list[0].plate,
      region: list[0].garage.owner.region,
      vehicles: list.map((v, i) => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        createdAt: v.createdAt,
        garageId: v.garageId,
        garageName: v.garage.name,
        ownerAccountId: v.garage.ownerId,
        ownerName: v.garage.owner.user.name,
        recordCount: recordCounts[i],
      })),
    });
  }

  // Most-duplicated first, then alphabetical by plate.
  duplicates.sort((a, b) => b.vehicles.length - a.vehicles.length || a.plate.localeCompare(b.plate));
  return duplicates;
}
