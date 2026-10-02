import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/vehicles/:id/insights — computed server-side from real rows,
// never hardcoded/cached:
// - runningCost: sum of fuel + service + repair + expense amounts
// - costPerKm: runningCost / (vehicle.odometerKm - earliest odometer seen
//   across every record + reading) — null if there isn't enough odometer
//   history to establish a distance baseline
// - categoryBreakdown: totals per record type, plus expense sub-categories
// - monthByMonth: total cost per calendar month (YYYY-MM), oldest first
//
// AGENTS.md scalability pass, section 17: this used to fetch every
// fuel/service/repair/expense/odometer row for the vehicle and sum them in
// JS — an unbounded per-request row load that grows without limit as a
// vehicle accumulates history (exactly the "load every row and sum in JS"
// anti-pattern the pass calls out). Every total below is now computed with
// a DB-side aggregate/groupBy (or a single grouped raw SQL query for the
// month-by-month breakdown, since Prisma's groupBy doesn't support
// date-truncation) — response time and memory no longer scale with a
// vehicle's record count, only with the number of distinct months (for
// monthByMonth) or O(1) (for everything else).
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
    const toNumber = (value: unknown): number =>
      value == null
        ? 0
        : typeof value === "object" && "toNumber" in (value as object)
          ? (value as { toNumber: () => number }).toNumber()
          : Number(value);

    const [fuelAgg, serviceAgg, repairAgg, expenseAgg, expenseByCategory, odometerAgg] = await Promise.all([
      prisma.fuelRecord.aggregate({ where, _sum: { amount: true }, _min: { odometerAtEntry: true } }),
      prisma.serviceRecord.aggregate({ where, _sum: { amount: true }, _min: { odometerAtEntry: true } }),
      prisma.repairRecord.aggregate({ where, _sum: { amount: true }, _min: { odometerAtEntry: true } }),
      prisma.expenseRecord.aggregate({ where, _sum: { amount: true }, _min: { odometerAtEntry: true } }),
      prisma.expenseRecord.groupBy({ by: ["category"], where, _sum: { amount: true } }),
      prisma.odometerReading.aggregate({ where: { vehicleId }, _min: { odometerKm: true } }),
    ]);

    const categoryBreakdown = {
      fuel: toNumber(fuelAgg._sum.amount),
      service: toNumber(serviceAgg._sum.amount),
      repair: toNumber(repairAgg._sum.amount),
      expense: toNumber(expenseAgg._sum.amount),
      expenseByCategory: Object.fromEntries(
        expenseByCategory.map((row) => [row.category, toNumber(row._sum.amount)]),
      ) as Record<string, number>,
    };

    const runningCost =
      categoryBreakdown.fuel + categoryBreakdown.service + categoryBreakdown.repair + categoryBreakdown.expense;

    const odometerMins = [
      fuelAgg._min.odometerAtEntry,
      serviceAgg._min.odometerAtEntry,
      repairAgg._min.odometerAtEntry,
      expenseAgg._min.odometerAtEntry,
      odometerAgg._min.odometerKm,
    ].filter((v): v is number => v != null);
    const earliestOdometer = odometerMins.length > 0 ? Math.min(...odometerMins) : null;
    const distanceTraveled =
      earliestOdometer != null && vehicle.odometerKm > earliestOdometer
        ? vehicle.odometerKm - earliestOdometer
        : null;
    const costPerKm = distanceTraveled ? runningCost / distanceTraveled : null;

    // Month-by-month total cost across the four money-bearing record types,
    // grouped by calendar month at the database level (DATE_TRUNC) — a
    // single query whose result size is bounded by the number of distinct
    // months this vehicle has history for, not its row count. Prisma's
    // typed query builder has no date-truncating groupBy, so this is the
    // one raw SQL query in this route; parameters are passed through the
    // tagged-template (Prisma parameterizes them — not string
    // interpolation), so this is not vulnerable to SQL injection.
    const monthRows = await prisma.$queryRaw<Array<{ month: string; total: string }>>`
      SELECT to_char(date_trunc('month', combined.date), 'YYYY-MM') AS month,
             SUM(combined.amount)::text AS total
      FROM (
        SELECT date, amount FROM fuel_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT date, amount FROM service_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT date, amount FROM repair_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT date, amount FROM expense_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
      ) combined
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const monthByMonth = monthRows.map((row) => ({ month: row.month, total: Number(row.total) }));

    return apiOk({
      runningCost,
      costPerKm,
      distanceTraveled,
      categoryBreakdown,
      monthByMonth,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
