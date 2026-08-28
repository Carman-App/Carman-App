import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

type CostRow = { amount: unknown; date: Date; odometerAtEntry: number };

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // "YYYY-MM"
}

// GET /api/v1/vehicles/:id/insights — computed server-side from real rows,
// never hardcoded/cached:
// - runningCost: sum of fuel + service + repair + expense amounts
// - costPerKm: runningCost / (vehicle.odometerKm - earliest odometer seen
//   across every record + reading) — null if there isn't enough odometer
//   history to establish a distance baseline
// - categoryBreakdown: totals per record type, plus expense sub-categories
// - monthByMonth: total cost per calendar month (YYYY-MM), oldest first
// Chain: auth -> account -> membership/ownership -> compute.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { odometerKm: true },
    });
    if (!vehicle) {
      throw new NotFoundError("Vehicle not found.");
    }

    const where = { vehicleId, deletedAt: null };
    const [fuel, service, repair, expense, odometerReadings] = await Promise.all([
      prisma.fuelRecord.findMany({ where, select: { amount: true, date: true, odometerAtEntry: true } }),
      prisma.serviceRecord.findMany({ where, select: { amount: true, date: true, odometerAtEntry: true } }),
      prisma.repairRecord.findMany({ where, select: { amount: true, date: true, odometerAtEntry: true } }),
      prisma.expenseRecord.findMany({
        where,
        select: { amount: true, date: true, odometerAtEntry: true, category: true },
      }),
      prisma.odometerReading.findMany({ where: { vehicleId }, select: { odometerKm: true } }),
    ]);

    const toNumber = (value: unknown): number =>
      typeof value === "object" && value !== null && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value);

    const categoryBreakdown = {
      fuel: sumAmount(fuel, toNumber),
      service: sumAmount(service, toNumber),
      repair: sumAmount(repair, toNumber),
      expense: sumAmount(expense, toNumber),
      expenseByCategory: {} as Record<string, number>,
    };
    for (const row of expense) {
      const amount = toNumber(row.amount);
      categoryBreakdown.expenseByCategory[row.category] =
        (categoryBreakdown.expenseByCategory[row.category] ?? 0) + amount;
    }

    const runningCost =
      categoryBreakdown.fuel + categoryBreakdown.service + categoryBreakdown.repair + categoryBreakdown.expense;

    const monthByMonth: Record<string, number> = {};
    for (const rows of [fuel, service, repair, expense] as CostRow[][]) {
      for (const row of rows) {
        const key = monthKey(row.date);
        monthByMonth[key] = (monthByMonth[key] ?? 0) + toNumber(row.amount);
      }
    }
    const monthByMonthSorted = Object.entries(monthByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    const odometerSamples = [
      ...fuel.map((r) => r.odometerAtEntry),
      ...service.map((r) => r.odometerAtEntry),
      ...repair.map((r) => r.odometerAtEntry),
      ...expense.map((r) => r.odometerAtEntry),
      ...odometerReadings.map((r) => r.odometerKm),
    ];
    const earliestOdometer = odometerSamples.length > 0 ? Math.min(...odometerSamples) : null;
    const distanceTraveled =
      earliestOdometer != null && vehicle.odometerKm > earliestOdometer
        ? vehicle.odometerKm - earliestOdometer
        : null;
    const costPerKm = distanceTraveled ? runningCost / distanceTraveled : null;

    return apiOk({
      runningCost,
      costPerKm,
      distanceTraveled,
      categoryBreakdown,
      monthByMonth: monthByMonthSorted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function sumAmount(rows: { amount: unknown }[], toNumber: (v: unknown) => number): number {
  return rows.reduce((total, row) => total + toNumber(row.amount), 0);
}
