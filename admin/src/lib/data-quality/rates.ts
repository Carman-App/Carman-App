import "server-only";
import { prisma } from "@/lib/prisma";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS } from "@/lib/region";
import type { RecordType } from "@/lib/records";
import { RECORD_TYPES, RECORD_TYPE_LABELS } from "./record-counts";
import { daysAgo } from "./period";

// DATA-02 — "entered late" threshold: a record whose `createdAt` (when it was
// entered) is more than this many days after its own effective `date` counts
// as entered late. 3 days is picked as a clear, generous cutoff — long
// enough that logging a fill-up or service a day or two after the fact
// (normal behaviour) doesn't count against an account, short enough that
// "entered a receipt from three weeks ago" still gets flagged. `date` and
// `createdAt` both existed before this pass, so this rate is fully real —
// no caveat needed (contrast with the edited-rate caveat below).
export const ENTERED_LATE_THRESHOLD_DAYS = 3;
const ENTERED_LATE_THRESHOLD_MS = ENTERED_LATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

// DATA-02 — edited-rate caveat: `editedAt` only started being stamped once
// src/app/api/v1/records/[id]/route.ts's PATCH handler was wired up (see
// prisma/schema.prisma's FuelRecord.editedAt comment). It is null both for
// "created before this existed" rows AND for "created since, but genuinely
// never edited" rows — those two cases are indistinguishable from the column
// alone. Rather than guess a cutoff date to exclude old rows (which would
// itself be an assumption this codebase has no record of), this reports the
// raw share of editedAt != null and states that caveat plainly in the UI.
export const EDITED_RATE_CAVEAT =
  "\"Edited\" only counts records edited through the API since editedAt started being stamped. Older records that were genuinely never edited are indistinguishable here from records edited before that column existed — so this is a raw share, not a corrected rate, and likely undercounts true edit activity for older data.";

type RateRow = { vehicleId: string; date: Date; createdAt: Date; editedAt: Date | null };

async function fetchRows(type: RecordType, since: Date): Promise<RateRow[]> {
  const createdAt = { gte: since };
  const select = { vehicleId: true, date: true, createdAt: true, editedAt: true } as const;
  switch (type) {
    case "fuel":
      return prisma.fuelRecord.findMany({ where: { createdAt, deletedAt: null }, select });
    case "service":
      return prisma.serviceRecord.findMany({ where: { createdAt, deletedAt: null }, select });
    case "repair":
      return prisma.repairRecord.findMany({ where: { createdAt, deletedAt: null }, select });
    case "expense":
      return prisma.expenseRecord.findMany({ where: { createdAt, deletedAt: null }, select });
    case "odometer":
      return prisma.odometerReading.findMany({ where: { createdAt }, select });
  }
}

async function regionByVehicleId(vehicleIds: string[]): Promise<Map<string, Region>> {
  if (vehicleIds.length === 0) return new Map();
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { id: true, garage: { select: { owner: { select: { region: true } } } } },
  });
  const map = new Map<string, Region>();
  vehicles.forEach((v) => map.set(v.id, v.garage.owner.region));
  return map;
}

export type RateBucket = {
  key: string;
  label: string;
  totalCount: number;
  editedCount: number;
  editedRate: number | null; // null when totalCount is 0
  lateCount: number;
  lateRate: number | null; // null when totalCount is 0
};

export type EditedLateRatesReport = {
  since: Date;
  thresholdDays: number;
  byType: RateBucket[];
  byRegion: RateBucket[];
  overall: RateBucket;
};

type Agg = { total: number; edited: number; late: number };

function isLate(row: RateRow): boolean {
  return row.createdAt.getTime() - row.date.getTime() > ENTERED_LATE_THRESHOLD_MS;
}

function addRow(agg: Agg, row: RateRow): Agg {
  return {
    total: agg.total + 1,
    edited: agg.edited + (row.editedAt ? 1 : 0),
    late: agg.late + (isLate(row) ? 1 : 0),
  };
}

function toBucket(key: string, label: string, agg: Agg): RateBucket {
  return {
    key,
    label,
    totalCount: agg.total,
    editedCount: agg.edited,
    editedRate: agg.total === 0 ? null : agg.edited / agg.total,
    lateCount: agg.late,
    lateRate: agg.total === 0 ? null : agg.late / agg.total,
  };
}

export async function getEditedLateRates(days: number): Promise<EditedLateRatesReport> {
  const since = daysAgo(days);
  const rowsByType = await Promise.all(RECORD_TYPES.map((t) => fetchRows(t, since)));
  const allVehicleIds = [...new Set(rowsByType.flat().map((r) => r.vehicleId))];
  const regionMap = await regionByVehicleId(allVehicleIds);

  const byType: RateBucket[] = RECORD_TYPES.map((type, i) => {
    const agg = rowsByType[i].reduce(addRow, { total: 0, edited: 0, late: 0 });
    return toBucket(type, RECORD_TYPE_LABELS[type], agg);
  });

  const byRegionAgg = new Map<Region, Agg>();
  let overallAgg: Agg = { total: 0, edited: 0, late: 0 };
  for (const row of rowsByType.flat()) {
    overallAgg = addRow(overallAgg, row);
    const region = regionMap.get(row.vehicleId);
    if (!region) continue; // shouldn't happen (every vehicle has a garage owner), but don't crash a report over it
    byRegionAgg.set(region, addRow(byRegionAgg.get(region) ?? { total: 0, edited: 0, late: 0 }, row));
  }

  const byRegion: RateBucket[] = [...byRegionAgg.entries()]
    .map(([region, agg]) => toBucket(region, REGION_LABELS[region], agg))
    .sort((a, b) => b.totalCount - a.totalCount);

  return {
    since,
    thresholdDays: ENTERED_LATE_THRESHOLD_DAYS,
    byType,
    byRegion,
    overall: toBucket("overall", "Overall", overallAgg),
  };
}
