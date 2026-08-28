import "server-only";
import { prisma } from "@/lib/prisma";

// GAR-04: flag implausible odometer trails. The console never edits a
// reading — every flag here is read-only annotation surfaced on the vehicle
// detail page and in the platform-wide list; correcting the underlying data
// is out of scope (there is no odometer-edit affordance anywhere).

/**
 * Plausible upper bound on how far a single vehicle could genuinely be
 * driven in one calendar day, generously sized for Carma's markets (e.g. a
 * Nairobi–Mombasa round trip is ~960km, Lagos–Abuja one-way is ~750km) so a
 * long highway trip alone never trips this — only entries that couldn't
 * reasonably reflect real driving do. Documented here rather than buried in
 * a magic number so a future tuning pass has one place to change it.
 */
export const MAX_PLAUSIBLE_KM_PER_DAY = 1000;

export type OdometerFlag =
  | {
      type: "ROLLBACK";
      readingId: string;
      date: Date;
      odometerKm: number;
      previousReadingId: string;
      previousDate: Date;
      previousOdometerKm: number;
    }
  | {
      type: "IMPLAUSIBLE_JUMP";
      readingId: string;
      date: Date;
      odometerKm: number;
      previousReadingId: string;
      previousDate: Date;
      previousOdometerKm: number;
      kmPerDay: number;
    }
  | {
      type: "DUPLICATE";
      readingId: string;
      date: Date;
      odometerKm: number;
      duplicateOfReadingId: string;
      duplicateOfDate: Date;
    };

export type OdometerReadingLike = {
  id: string;
  date: Date;
  odometerKm: number;
};

/**
 * Given a vehicle's `OdometerReading` rows already sorted date-ascending
 * (ties broken by createdAt ascending — see callers), returns every flag
 * found. A single reading can carry more than one flag (e.g. it can both
 * roll back and repeat an earlier value).
 */
export function flagOdometerTrail(readingsAsc: OdometerReadingLike[]): OdometerFlag[] {
  const flags: OdometerFlag[] = [];
  const firstSeenByValue = new Map<number, { id: string; date: Date }>();

  for (let i = 0; i < readingsAsc.length; i++) {
    const cur = readingsAsc[i];

    // (c) duplicate reading — same value logged twice for this vehicle,
    // regardless of how far apart in the trail.
    const dup = firstSeenByValue.get(cur.odometerKm);
    if (dup) {
      flags.push({
        type: "DUPLICATE",
        readingId: cur.id,
        date: cur.date,
        odometerKm: cur.odometerKm,
        duplicateOfReadingId: dup.id,
        duplicateOfDate: dup.date,
      });
    } else {
      firstSeenByValue.set(cur.odometerKm, { id: cur.id, date: cur.date });
    }

    if (i === 0) continue;
    const prev = readingsAsc[i - 1];

    // (a) rollback — a later reading lower than an earlier one.
    if (cur.odometerKm < prev.odometerKm) {
      flags.push({
        type: "ROLLBACK",
        readingId: cur.id,
        date: cur.date,
        odometerKm: cur.odometerKm,
        previousReadingId: prev.id,
        previousDate: prev.date,
        previousOdometerKm: prev.odometerKm,
      });
      continue; // a rollback isn't also evaluated as a jump
    }

    // (b) implausible jump — km/day between consecutive dated readings
    // exceeds MAX_PLAUSIBLE_KM_PER_DAY. Floor elapsed time at one hour so
    // two readings logged on the same date don't divide by ~0.
    const elapsedDays = Math.max((cur.date.getTime() - prev.date.getTime()) / 86_400_000, 1 / 24);
    const kmPerDay = (cur.odometerKm - prev.odometerKm) / elapsedDays;
    if (kmPerDay > MAX_PLAUSIBLE_KM_PER_DAY) {
      flags.push({
        type: "IMPLAUSIBLE_JUMP",
        readingId: cur.id,
        date: cur.date,
        odometerKm: cur.odometerKm,
        previousReadingId: prev.id,
        previousDate: prev.date,
        previousOdometerKm: prev.odometerKm,
        kmPerDay,
      });
    }
  }

  return flags;
}

export type FlaggedVehicle = {
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    plate: string;
    garageId: string;
    garageName: string;
    ownerAccountId: string;
    ownerName: string;
  };
  flags: OdometerFlag[];
};

/**
 * Platform-wide scan for GAR-04's "counted platform-wide" requirement. Reads
 * every vehicle's odometer trail and runs flagOdometerTrail() over it —
 * there's no precomputed/cached flag table, so this is a live scan each
 * time the page loads (fine at this app's scale; revisit with a materialized
 * table if the fleet grows large).
 */
export async function getFlaggedVehiclesPlatformWide(): Promise<FlaggedVehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      garage: { include: { owner: { include: { user: true } } } },
      odometerReadings: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });

  const flagged: FlaggedVehicle[] = [];
  for (const v of vehicles) {
    const flags = flagOdometerTrail(v.odometerReadings);
    if (flags.length === 0) continue;
    flagged.push({
      vehicle: {
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        plate: v.plate,
        garageId: v.garageId,
        garageName: v.garage.name,
        ownerAccountId: v.garage.ownerId,
        ownerName: v.garage.owner.user.name,
      },
      flags,
    });
  }
  return flagged;
}
