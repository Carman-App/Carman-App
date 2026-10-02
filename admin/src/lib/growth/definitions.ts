import "server-only";
import { prisma } from "@/lib/prisma";
import { ProfileType } from "@/generated/prisma/enums";
import { getFxRateMap, convertCentsToReportingCurrency, type FxRateRow } from "@/lib/money/fx";
import { REPORTING_CURRENCY as MONEY_REPORTING_CURRENCY } from "@/lib/money/currency";

/**
 * GROW-01..08 — single source of truth for every metric definition this
 * surface uses. Every page under src/app/(dashboard)/growth/** (directly, or
 * via a src/lib/growth/*.ts helper) imports from here rather than
 * recomputing its own version of "active", "record", "activated", etc. See
 * AGENTS.md's brief for this work for the prose definitions this file
 * implements — the comments below restate the parts that affect the code,
 * not the whole brief.
 */

// ---------------------------------------------------------------------------
// Week bucketing — same ISO week convention (Mon-start) as
// src/lib/money/cohorts.ts's isoWeekKey/weekStart, which aren't exported
// there. Replicated here rather than reached into money/ for what is a
// generic date utility, not a Money-specific one.
// ---------------------------------------------------------------------------

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function weekStart(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 1); // back to Monday
  return date;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type DateRange = { start: Date; end: Date };

/** [start, end) instants for the last `days` days, ending now. */
export function trailingWindow(days: number, reference: Date = new Date()): DateRange {
  const end = reference;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Record — exactly Pulse's `records_logged` definition (src/lib/pulse/
// metrics.ts): a row in FuelRecord/ServiceRecord/RepairRecord/ExpenseRecord
// (excluding deletedAt != null) or OdometerReading (no deletedAt column).
// Growth needs the *who* (enteredByAccountId) and *where* (vehicleId), not
// just a count, so this fetches minimal per-record projections rather than
// re-deriving Pulse's plain counts — same where-shape, described in the
// comment on each query below, copy of Pulse's shape rather than a call into
// it because Pulse's countInRange() is a private, non-exported function.
// ---------------------------------------------------------------------------

export type MinimalRecord = {
  vehicleId: string;
  /** enteredByAccountId — null when a record was entered without an attributable account. */
  accountId: string | null;
  createdAt: Date;
};

/**
 * All qualifying records (optionally restricted to a createdAt window).
 * Mirrors src/lib/pulse/metrics.ts's records_logged exactly: fuel/service/
 * repair/expense excluding soft-deleted rows, plus odometer readings (no
 * deletedAt column on that table).
 */
export async function fetchRecords(range?: DateRange): Promise<MinimalRecord[]> {
  const dateWhere = range ? { createdAt: { gte: range.start, lt: range.end } } : {};
  const deletable = { ...dateWhere, deletedAt: null };
  const select = { vehicleId: true, enteredByAccountId: true, createdAt: true } as const;

  const [fuel, service, repair, expense, odometer] = await Promise.all([
    prisma.fuelRecord.findMany({ where: deletable, select }),
    prisma.serviceRecord.findMany({ where: deletable, select }),
    prisma.repairRecord.findMany({ where: deletable, select }),
    prisma.expenseRecord.findMany({ where: deletable, select }),
    prisma.odometerReading.findMany({ where: dateWhere, select }), // no deletedAt column
  ]);

  return [...fuel, ...service, ...repair, ...expense, ...odometer].map((r) => ({
    vehicleId: r.vehicleId,
    accountId: r.enteredByAccountId,
    createdAt: r.createdAt,
  }));
}

/** Plain count in a window — same 5-table union as fetchRecords, without pulling row data. */
export async function countRecords(range?: DateRange): Promise<number> {
  const dateWhere = range ? { createdAt: { gte: range.start, lt: range.end } } : {};
  const deletable = { ...dateWhere, deletedAt: null };
  const [fuel, service, repair, expense, odometer] = await Promise.all([
    prisma.fuelRecord.count({ where: deletable }),
    prisma.serviceRecord.count({ where: deletable }),
    prisma.repairRecord.count({ where: deletable }),
    prisma.expenseRecord.count({ where: deletable }),
    prisma.odometerReading.count({ where: dateWhere }),
  ]);
  return fuel + service + repair + expense + odometer;
}

// ---------------------------------------------------------------------------
// Active user — exactly Pulse's proxy: an Account with lastApiRequestAt
// inside the window. Pulse documents (src/lib/pulse/metrics.ts) that this
// stands in for "opened the app" only because no session/open-app analytics
// exist; the same caveat applies here, restated below as ACTIVE_USER_CAVEAT
// for use directly in the UI.
// ---------------------------------------------------------------------------

export const ACTIVE_USER_CAVEAT =
  "“Active” is a proxy: Account.lastApiRequestAt is the timestamp of an account's most recent authenticated API call, not a real session/open-app log. There is exactly one such timestamp per account (not a history), so an account can only ever be counted active in the single week/month containing whatever that value currently is — never in more than one period at once. See src/lib/pulse/metrics.ts for the same definition and caveat.";

export async function getActiveAccountIds(range: DateRange): Promise<Set<string>> {
  const rows = await prisma.account.findMany({
    where: { lastApiRequestAt: { gte: range.start, lt: range.end } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export async function countActiveAccounts(range: DateRange): Promise<number> {
  return prisma.account.count({ where: { lastApiRequestAt: { gte: range.start, lt: range.end } } });
}

// ---------------------------------------------------------------------------
// Active garage — GROW's own extension of Active user to the garage level
// (not a Phase One term carried over; there is no earlier brief for this
// exact wording in this repo). Defined as: a Garage with at least one Record
// (per the definition above) logged against any of its vehicles within the
// window.
// ---------------------------------------------------------------------------

export async function getActiveGarageIds(range: DateRange): Promise<Set<string>> {
  const records = await fetchRecords(range);
  const vehicleIds = [...new Set(records.map((r) => r.vehicleId))];
  if (vehicleIds.length === 0) return new Set();
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { garageId: true },
  });
  return new Set(vehicles.map((v) => v.garageId));
}

// ---------------------------------------------------------------------------
// Vehicle added — an Account that owns a garage with at least one Vehicle.
// Same "vehicle added" step used by the GROW-01 funnel (funnel.ts) — shared
// here so the Activated-account definition below can't silently drift from
// the funnel's own "vehicle added" step (NOT-05: never redefine a metric
// silently).
// ---------------------------------------------------------------------------

export async function getVehicleAddedAccountIds(): Promise<Set<string>> {
  const rows = await prisma.account.findMany({
    where: { garagesOwned: { some: { vehicles: { some: {} } } } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/** accountId -> every record timestamp they've logged, ascending. Non-attributable (null accountId) records are excluded — they can't count toward any account's activation. */
export async function getAccountRecordTimestamps(range?: DateRange): Promise<Map<string, Date[]>> {
  const records = await fetchRecords(range);
  const byAccount = new Map<string, Date[]>();
  for (const r of records) {
    if (!r.accountId) continue;
    const list = byAccount.get(r.accountId);
    if (list) list.push(r.createdAt);
    else byAccount.set(r.accountId, [r.createdAt]);
  }
  for (const list of byAccount.values()) list.sort((a, b) => a.getTime() - b.getTime());
  return byAccount;
}

// ---------------------------------------------------------------------------
// Activated account — per the spec verbatim: "added a vehicle AND logged one
// record. Signing up alone is not activation." Both halves are required:
// logging a record alone is possible for a garage member who never added a
// vehicle themselves (someone else in the garage did), so a record-only check
// would over-count activation for that account. Fixed to require both halves
// — previously this only checked "logged a record", which is what NOT-05
// calls a silently redefined metric.
// ---------------------------------------------------------------------------

export async function getActivatedAccountIds(): Promise<Set<string>> {
  const [recordAccountIds, vehicleAddedIds] = await Promise.all([
    getAccountRecordTimestamps(),
    getVehicleAddedAccountIds(),
  ]);
  const activated = new Set<string>();
  for (const id of recordAccountIds.keys()) {
    if (vehicleAddedIds.has(id)) activated.add(id);
  }
  return activated;
}

// ---------------------------------------------------------------------------
// Retained — an Account counted Active (per Active-user definition) in its
// signup week, and Active again in a later week K weeks after. See
// ACTIVE_USER_CAVEAT above: because lastApiRequestAt is a single timestamp,
// not a history, no account can structurally ever be "Active" in two
// different weeks under this definition at once — this is a real, stated
// limitation of the retention grid (GROW-03), not a bug in the grid's math.
// ---------------------------------------------------------------------------

export function isActiveInWeek(lastApiRequestAt: Date | null, weekStartDate: Date): boolean {
  if (!lastApiRequestAt) return false;
  const nextWeek = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return lastApiRequestAt >= weekStartDate && lastApiRequestAt < nextWeek;
}

// ---------------------------------------------------------------------------
// MRR / Churn — delegate entirely to src/lib/money/mrr.ts. Re-exported here
// only so growth pages have one import path; the implementation is not
// duplicated.
// ---------------------------------------------------------------------------

export { getMrrSnapshot, getMonthlyMovement } from "@/lib/money/mrr";

// ---------------------------------------------------------------------------
// Collection rate — NEW metric, not previously implemented anywhere else in
// this codebase. Defined as:
//   sum(Payment.amount where deletedAt is null and paidAt in period)
//   / sum(Invoice.total where deletedAt is null and createdAt in period)
// both summed as Decimal, expressed as a percentage. Note the numerator and
// denominator are not the same invoices (an invoice created in the period
// may be paid later, and a payment in the period may be against an invoice
// created earlier) — this is a period-over-period collection efficiency
// figure, not a per-invoice reconciliation.
// ---------------------------------------------------------------------------

export type CollectionRate = {
  collectedTotal: number; // sum(Payment.amount) in period
  invoicedTotal: number; // sum(Invoice.total) in period
  ratePercent: number | null; // null when invoicedTotal is 0 (nothing to divide by)
};

export async function getCollectionRate(range: DateRange): Promise<CollectionRate> {
  const [paidAgg, invoicedAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { paidAt: { gte: range.start, lt: range.end }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { createdAt: { gte: range.start, lt: range.end }, deletedAt: null },
      _sum: { total: true },
    }),
  ]);
  const collectedTotal = paidAgg._sum.amount?.toNumber() ?? 0;
  const invoicedTotal = invoicedAgg._sum.total?.toNumber() ?? 0;
  return {
    collectedTotal,
    invoicedTotal,
    ratePercent: invoicedTotal === 0 ? null : (collectedTotal / invoicedTotal) * 100,
  };
}

// ---------------------------------------------------------------------------
// Mechanic attach rate — GROW-05, both directions.
// ---------------------------------------------------------------------------

export type MechanicAttachRate = {
  /** (a) share of active OWNER-profile accounts with >=1 Job in the window against a vehicle they own or belong to. */
  ownerSide: { activeOwnerAccounts: number; withAttachedJob: number; ratePercent: number | null };
  /** (b) share of Jobs in the window that reference a real Carma vehicle (vehicleId != null). */
  jobSide: { totalJobs: number; withRealVehicle: number; ratePercent: number | null };
};

export async function getMechanicAttachRate(range: DateRange): Promise<MechanicAttachRate> {
  // (a) Active OWNER-profile accounts, per the Active-user definition above.
  const activeOwnerAccounts = await prisma.account.findMany({
    where: {
      lastApiRequestAt: { gte: range.start, lt: range.end },
      profiles: { some: { type: ProfileType.OWNER } },
    },
    select: { id: true },
  });

  // Vehicles each account can reach: owns the garage, or holds a vehicle-level membership.
  const [ownedVehicles, memberVehicles] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, garage: { select: { ownerId: true } } } }),
    prisma.vehicleMembership.findMany({ select: { vehicleId: true, accountId: true } }),
  ]);
  const vehiclesByAccount = new Map<string, Set<string>>();
  for (const v of ownedVehicles) {
    const set = vehiclesByAccount.get(v.garage.ownerId) ?? new Set<string>();
    set.add(v.id);
    vehiclesByAccount.set(v.garage.ownerId, set);
  }
  for (const m of memberVehicles) {
    const set = vehiclesByAccount.get(m.accountId) ?? new Set<string>();
    set.add(m.vehicleId);
    vehiclesByAccount.set(m.accountId, set);
  }

  const jobsInWindow = await prisma.job.findMany({
    where: { createdAt: { gte: range.start, lt: range.end }, vehicleId: { not: null } },
    select: { vehicleId: true },
  });
  const vehicleIdsWithJob = new Set(jobsInWindow.map((j) => j.vehicleId as string));

  let withAttachedJob = 0;
  for (const acc of activeOwnerAccounts) {
    const vehicleIds = vehiclesByAccount.get(acc.id);
    if (vehicleIds && [...vehicleIds].some((id) => vehicleIdsWithJob.has(id))) withAttachedJob++;
  }

  // (b) reverse direction — every Job in the window vs. those with a real vehicle link.
  const [totalJobs, withRealVehicle] = await Promise.all([
    prisma.job.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
    prisma.job.count({ where: { createdAt: { gte: range.start, lt: range.end }, vehicleId: { not: null } } }),
  ]);

  return {
    ownerSide: {
      activeOwnerAccounts: activeOwnerAccounts.length,
      withAttachedJob,
      ratePercent: activeOwnerAccounts.length === 0 ? null : (withAttachedJob / activeOwnerAccounts.length) * 100,
    },
    jobSide: {
      totalJobs,
      withRealVehicle,
      ratePercent: totalJobs === 0 ? null : (withRealVehicle / totalJobs) * 100,
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting currency — Money's convention (REPORTING_CURRENCY = "USD" from
// src/lib/money/currency.ts, converted via src/lib/money/fx.ts's
// getFxRateMap/convertCentsToReportingCurrency). This deliberately differs
// from Pulse's fixed-KES-no-conversion REPORTING_CURRENCY
// (src/lib/pulse/metrics.ts): GROW-07 explicitly needs real multi-currency
// roll-up across KE/UG/TZ/NG/ZA/US/GB, which only Money's FX module
// supports. Pulse's simpler convention stays correct for Pulse's own
// narrower (KES-first) use and is untouched.
// ---------------------------------------------------------------------------

export const REPORTING_CURRENCY = MONEY_REPORTING_CURRENCY;
export type { FxRateRow };
export { getFxRateMap };

/**
 * Convert a whole-currency-unit Decimal amount (e.g. Invoice.total, in KES
 * or whatever currency applies) to the reporting currency. Reuses Money's
 * convertCentsToReportingCurrency exactly rather than re-deriving FX math —
 * that helper operates on integer cents, so the amount is scaled to
 * "cents" and back rather than duplicating the rate lookup/multiply logic.
 * Returns null when no FxRate is on file for `currency` (same as the cents
 * version) rather than guessing.
 */
export function convertAmountToReportingCurrency(
  amount: number,
  currency: string,
  rates: Map<string, FxRateRow>,
): number | null {
  const cents = convertCentsToReportingCurrency(Math.round(amount * 100), currency, rates);
  return cents == null ? null : cents / 100;
}
