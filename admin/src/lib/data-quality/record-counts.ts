import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import type { RecordType } from "@/lib/records";
import { currentAndPriorPeriod, percentChange, type PeriodRange } from "./period";

// DATA-01 — record counts by type. Exactly the five record tables in the
// schema (fuel/service/repair/expense/odometer); no other "record types"
// exist in this codebase to count.
export const RECORD_TYPES: RecordType[] = ["fuel", "service", "repair", "expense", "odometer"];

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  fuel: "Fuel",
  service: "Service",
  repair: "Repair",
  expense: "Expense",
  odometer: "Odometer",
};

export type RecordTypeCountStat = {
  type: RecordType;
  label: string;
  count: number;
  distinctAccounts: number;
  /** This type's share of the total across all five types in the current period, 0..1. */
  shareOfTotal: number;
  priorCount: number;
  /** null when priorCount is 0 — no baseline to compute a percentage against. */
  trendPercent: number | null;
};

export type RecordCountsReport = {
  period: PeriodRange;
  priorPeriod: PeriodRange;
  stats: RecordTypeCountStat[];
  totalCount: number;
};

// Counts (and the "distinct accounts" below) are keyed off `createdAt` — when
// the record was entered — not its own effective `date` field, matching how
// Pulse's "records_logged" metric already counts entries (see
// src/lib/pulse/metrics.ts). A record dated last month but entered today
// counts as "entered" today; DATA-02 is where date-vs-createdAt skew (entered
// late) is measured explicitly.
async function countInRange(type: RecordType, range: PeriodRange): Promise<number> {
  const createdAt = { gte: range.start, lt: range.end };
  switch (type) {
    case "fuel":
      return prisma.fuelRecord.count({ where: { createdAt, deletedAt: null } });
    case "service":
      return prisma.serviceRecord.count({ where: { createdAt, deletedAt: null } });
    case "repair":
      return prisma.repairRecord.count({ where: { createdAt, deletedAt: null } });
    case "expense":
      return prisma.expenseRecord.count({ where: { createdAt, deletedAt: null } });
    case "odometer":
      // OdometerReading has no deletedAt column (see prisma/schema.prisma header note / src/lib/records.ts).
      return prisma.odometerReading.count({ where: { createdAt } });
  }
}

async function vehicleIdsInRange(type: RecordType, range: PeriodRange): Promise<string[]> {
  const createdAt = { gte: range.start, lt: range.end };
  let rows: { vehicleId: string }[];
  switch (type) {
    case "fuel":
      rows = await prisma.fuelRecord.findMany({ where: { createdAt, deletedAt: null }, select: { vehicleId: true }, distinct: ["vehicleId"] });
      break;
    case "service":
      rows = await prisma.serviceRecord.findMany({ where: { createdAt, deletedAt: null }, select: { vehicleId: true }, distinct: ["vehicleId"] });
      break;
    case "repair":
      rows = await prisma.repairRecord.findMany({ where: { createdAt, deletedAt: null }, select: { vehicleId: true }, distinct: ["vehicleId"] });
      break;
    case "expense":
      rows = await prisma.expenseRecord.findMany({ where: { createdAt, deletedAt: null }, select: { vehicleId: true }, distinct: ["vehicleId"] });
      break;
    case "odometer":
      rows = await prisma.odometerReading.findMany({ where: { createdAt }, select: { vehicleId: true }, distinct: ["vehicleId"] });
      break;
  }
  return rows.map((r) => r.vehicleId);
}

/**
 * "Distinct accounts" for a set of vehicles = the garage owner's account
 * (vehicle -> garage -> owner) UNION every account with a VehicleMembership
 * on that vehicle — both are legitimate ways an account "touches" a vehicle
 * per the schema (see prisma/schema.prisma Vehicle/VehicleMembership).
 */
async function distinctAccountCount(vehicleIds: string[]): Promise<number> {
  if (vehicleIds.length === 0) return 0;
  const [vehicles, memberships] = await Promise.all([
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { garage: { select: { ownerId: true } } },
    }),
    prisma.vehicleMembership.findMany({
      where: { vehicleId: { in: vehicleIds } },
      select: { accountId: true },
    }),
  ]);
  const accountIds = new Set<string>();
  vehicles.forEach((v) => accountIds.add(v.garage.ownerId));
  memberships.forEach((m) => accountIds.add(m.accountId));
  return accountIds.size;
}

export async function getRecordCountsByType(days: number): Promise<RecordCountsReport> {
  const { current, prior } = currentAndPriorPeriod(days);

  const stats: RecordTypeCountStat[] = await Promise.all(
    RECORD_TYPES.map(async (type) => {
      const [count, priorCount, vehicleIds] = await Promise.all([
        countInRange(type, current),
        countInRange(type, prior),
        vehicleIdsInRange(type, current),
      ]);
      const distinctAccounts = await distinctAccountCount(vehicleIds);
      return {
        type,
        label: RECORD_TYPE_LABELS[type],
        count,
        distinctAccounts,
        priorCount,
        trendPercent: percentChange(count, priorCount),
        shareOfTotal: 0, // filled in below once totalCount is known
      };
    }),
  );

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);
  for (const s of stats) {
    s.shareOfTotal = totalCount === 0 ? 0 : s.count / totalCount;
  }

  return { period: current, priorPeriod: prior, stats, totalCount };
}
