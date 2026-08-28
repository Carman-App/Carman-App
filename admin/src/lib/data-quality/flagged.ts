import "server-only";
import { prisma } from "@/lib/prisma";
import type { RecordType } from "@/lib/records";

// DATA-03 — probably-mistaken records. These are flagged *questions* for a
// human to look at, never auto-corrected: nothing in this module writes to
// any record, and no page built on top of it offers a fix/edit action.

// Rule 3 (amount outlier): computed from the median amount for each
// amount-bearing type over the trailing 90 days, rather than a bare mean +
// stddev. Financial-record amounts (fuel/service/repair/expense) are
// typically right-skewed (many small routine entries, occasional large
// ones), which drags a mean upward and inflates a stddev — a single big
// repair bill can make an otherwise-normal fill-up "outlier" or hide a
// genuinely wrong one. The median is robust to that skew, so it's used as
// the "typical" reference point instead.
export const AMOUNT_OUTLIER_TRAILING_DAYS = 90;
// Exact rule: amount > 5x the type's trailing-90-day median, OR
// amount < (1/5)x that median. Symmetric multiplier chosen so the rule reads
// the same in both directions ("5x too big" / "5x too small").
export const AMOUNT_OUTLIER_HIGH_MULTIPLIER = 5;
export const AMOUNT_OUTLIER_LOW_DIVISOR = 5;

// Rule 4 (fuel volume): a fixed physical-world ceiling rather than a
// statistical one, since tank size has a real bound. 150 litres is
// generous for any vehicle class in this schema (VehicleType CAR or
// MOTORCYCLE) — even a large pickup or SUV tank tops out well under this,
// so it only catches genuinely implausible entries (e.g. a decimal-point
// slip), not a big vehicle's real fill-up.
export const FUEL_VOLUME_CEILING_LITRES = 150;

export type FlagReason = "ZERO_AMOUNT" | "FUTURE_DATED" | "AMOUNT_OUTLIER" | "IMPLAUSIBLE_FUEL_VOLUME";

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  ZERO_AMOUNT: "Zero amount",
  FUTURE_DATED: "Future-dated",
  AMOUNT_OUTLIER: `Amount >${AMOUNT_OUTLIER_HIGH_MULTIPLIER}x or <1/${AMOUNT_OUTLIER_LOW_DIVISOR}x the type's trailing ${AMOUNT_OUTLIER_TRAILING_DAYS}-day median`,
  IMPLAUSIBLE_FUEL_VOLUME: `Fuel volume over ${FUEL_VOLUME_CEILING_LITRES}L`,
};

export type FlaggedRecord = {
  id: string;
  type: RecordType;
  vehicleId: string;
  vehicleLabel: string;
  accountId: string;
  accountName: string;
  date: Date;
  amount: number | null;
  litres: number | null;
  reasons: FlagReason[];
};

export type FlaggedRecordsReport = {
  generatedAt: Date;
  windowDays: number;
  /** The trailing-90-day median used per type, for transparency — null when there were no rows to compute one from. */
  medians: Record<"fuel" | "service" | "repair" | "expense", number | null>;
  flagged: FlaggedRecord[];
  truncated: boolean;
};

const MAX_FLAGGED_ROWS = 500;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isOutlier(amount: number, med: number | null): boolean {
  if (amount === 0 || med == null || med <= 0) return false; // zero already gets its own ZERO_AMOUNT flag; no/zero median means no baseline to compare against
  return amount > med * AMOUNT_OUTLIER_HIGH_MULTIPLIER || amount < med / AMOUNT_OUTLIER_LOW_DIVISOR;
}

type RawFlag = { id: string; vehicleId: string; date: Date; amount: number | null; litres: number | null; reasons: FlagReason[] };

export async function getFlaggedRecords(): Promise<FlaggedRecordsReport> {
  const now = new Date();
  const since = new Date(now.getTime() - AMOUNT_OUTLIER_TRAILING_DAYS * 24 * 60 * 60 * 1000);
  // No upper bound on `date` — this deliberately also pulls in future-dated
  // rows (date > now), which fall outside the trailing window used for the
  // median but must still be scanned to catch rule 2.
  const dateWhere = { date: { gte: since } };

  const [fuelRows, serviceRows, repairRows, expenseRows, odometerRows] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: { ...dateWhere, deletedAt: null },
      select: { id: true, vehicleId: true, date: true, amount: true, litres: true },
    }),
    prisma.serviceRecord.findMany({
      where: { ...dateWhere, deletedAt: null },
      select: { id: true, vehicleId: true, date: true, amount: true },
    }),
    prisma.repairRecord.findMany({
      where: { ...dateWhere, deletedAt: null },
      select: { id: true, vehicleId: true, date: true, amount: true },
    }),
    prisma.expenseRecord.findMany({
      where: { ...dateWhere, deletedAt: null },
      select: { id: true, vehicleId: true, date: true, amount: true },
    }),
    prisma.odometerReading.findMany({
      where: dateWhere,
      select: { id: true, vehicleId: true, date: true },
    }),
  ]);

  function medianFor(rows: { date: Date; amount: { toNumber: () => number } }[]): number | null {
    const past = rows.filter((r) => r.date.getTime() <= now.getTime()).map((r) => r.amount.toNumber());
    return past.length === 0 ? null : median(past);
  }
  const fuelMedian = medianFor(fuelRows);
  const serviceMedian = medianFor(serviceRows);
  const repairMedian = medianFor(repairRows);
  const expenseMedian = medianFor(expenseRows);

  const raw: (RawFlag & { type: RecordType })[] = [];

  for (const r of fuelRows) {
    const amount = r.amount.toNumber();
    const litres = r.litres ? r.litres.toNumber() : null;
    const reasons: FlagReason[] = [];
    if (amount === 0) reasons.push("ZERO_AMOUNT");
    if (r.date.getTime() > now.getTime()) reasons.push("FUTURE_DATED");
    if (isOutlier(amount, fuelMedian)) reasons.push("AMOUNT_OUTLIER");
    if (litres != null && litres > FUEL_VOLUME_CEILING_LITRES) reasons.push("IMPLAUSIBLE_FUEL_VOLUME");
    if (reasons.length > 0) raw.push({ id: r.id, type: "fuel", vehicleId: r.vehicleId, date: r.date, amount, litres, reasons });
  }
  for (const r of serviceRows) {
    const amount = r.amount.toNumber();
    const reasons: FlagReason[] = [];
    if (amount === 0) reasons.push("ZERO_AMOUNT");
    if (r.date.getTime() > now.getTime()) reasons.push("FUTURE_DATED");
    if (isOutlier(amount, serviceMedian)) reasons.push("AMOUNT_OUTLIER");
    if (reasons.length > 0) raw.push({ id: r.id, type: "service", vehicleId: r.vehicleId, date: r.date, amount, litres: null, reasons });
  }
  for (const r of repairRows) {
    const amount = r.amount.toNumber();
    const reasons: FlagReason[] = [];
    if (amount === 0) reasons.push("ZERO_AMOUNT");
    if (r.date.getTime() > now.getTime()) reasons.push("FUTURE_DATED");
    if (isOutlier(amount, repairMedian)) reasons.push("AMOUNT_OUTLIER");
    if (reasons.length > 0) raw.push({ id: r.id, type: "repair", vehicleId: r.vehicleId, date: r.date, amount, litres: null, reasons });
  }
  for (const r of expenseRows) {
    const amount = r.amount.toNumber();
    const reasons: FlagReason[] = [];
    if (amount === 0) reasons.push("ZERO_AMOUNT");
    if (r.date.getTime() > now.getTime()) reasons.push("FUTURE_DATED");
    if (isOutlier(amount, expenseMedian)) reasons.push("AMOUNT_OUTLIER");
    if (reasons.length > 0) raw.push({ id: r.id, type: "expense", vehicleId: r.vehicleId, date: r.date, amount, litres: null, reasons });
  }
  for (const r of odometerRows) {
    if (r.date.getTime() > now.getTime()) {
      raw.push({ id: r.id, type: "odometer", vehicleId: r.vehicleId, date: r.date, amount: null, litres: null, reasons: ["FUTURE_DATED"] });
    }
  }

  raw.sort((a, b) => b.date.getTime() - a.date.getTime());
  const truncated = raw.length > MAX_FLAGGED_ROWS;
  const capped = raw.slice(0, MAX_FLAGGED_ROWS);

  const vehicleIds = [...new Set(capped.map((r) => r.vehicleId))];
  const vehicles = vehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          plate: true,
          garage: { select: { owner: { select: { id: true, user: { select: { name: true } } } } } },
        },
      })
    : [];
  const vehicleInfo = new Map(
    vehicles.map((v) => [
      v.id,
      {
        vehicleLabel: `${v.year} ${v.make} ${v.model} — ${v.plate}`,
        accountId: v.garage.owner.id,
        accountName: v.garage.owner.user.name,
      },
    ]),
  );

  const flagged: FlaggedRecord[] = capped.map((r) => {
    const info = vehicleInfo.get(r.vehicleId);
    return {
      id: r.id,
      type: r.type,
      vehicleId: r.vehicleId,
      vehicleLabel: info?.vehicleLabel ?? "Unknown vehicle",
      accountId: info?.accountId ?? "",
      accountName: info?.accountName ?? "Unknown",
      date: r.date,
      amount: r.amount,
      litres: r.litres,
      reasons: r.reasons,
    };
  });

  return {
    generatedAt: now,
    windowDays: AMOUNT_OUTLIER_TRAILING_DAYS,
    medians: {
      fuel: fuelMedian,
      service: serviceMedian,
      repair: repairMedian,
      expense: expenseMedian,
    },
    flagged,
    truncated,
  };
}
