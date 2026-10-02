import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type RecordFeedItem = {
  id: string;
  kind: "FUEL" | "SERVICE" | "REPAIR" | "EXPENSE" | "ODOMETER";
  date: Date;
  vehicleId: string;
  amount: Prisma.Decimal | null;
  description: string;
  enteredByName: string;
};

/**
 * Records are stored as one table per type (fuel/service/repair/expense/
 * odometer — see prisma/schema.prisma) rather than a single polymorphic
 * table. This merges them into the single reverse-chronological feed the
 * Records section and vehicle detail pages both need.
 */
export async function getRecordsFeed(options?: {
  vehicleId?: string;
  take?: number;
}): Promise<RecordFeedItem[]> {
  const where = options?.vehicleId
    ? { vehicleId: options.vehicleId, deletedAt: null }
    : { deletedAt: null };
  const take = options?.take ?? 100;

  const [fuel, service, repair, expense, odometer] = await Promise.all([
    prisma.fuelRecord.findMany({ where, orderBy: { date: "desc" }, take }),
    prisma.serviceRecord.findMany({ where, orderBy: { date: "desc" }, take }),
    prisma.repairRecord.findMany({ where, orderBy: { date: "desc" }, take }),
    prisma.expenseRecord.findMany({ where, orderBy: { date: "desc" }, take }),
    prisma.odometerReading.findMany({
      where: options?.vehicleId ? { vehicleId: options.vehicleId } : {},
      orderBy: { date: "desc" },
      take,
    }),
  ]);

  const items: RecordFeedItem[] = [
    ...fuel.map((r) => ({
      id: r.id,
      kind: "FUEL" as const,
      date: r.date,
      vehicleId: r.vehicleId,
      amount: r.amount,
      description: r.litres ? `Fuel — ${r.litres.toString()}L` : "Fuel",
      enteredByName: r.enteredByName,
    })),
    ...service.map((r) => ({
      id: r.id,
      kind: "SERVICE" as const,
      date: r.date,
      vehicleId: r.vehicleId,
      amount: r.amount,
      description: r.description ?? "Service",
      enteredByName: r.enteredByName,
    })),
    ...repair.map((r) => ({
      id: r.id,
      kind: "REPAIR" as const,
      date: r.date,
      vehicleId: r.vehicleId,
      amount: r.amount,
      description: r.description ?? "Repair",
      enteredByName: r.enteredByName,
    })),
    ...expense.map((r) => ({
      id: r.id,
      kind: "EXPENSE" as const,
      date: r.date,
      vehicleId: r.vehicleId,
      amount: r.amount,
      description: `Expense — ${r.category}`,
      enteredByName: r.enteredByName,
    })),
    ...odometer.map((r) => ({
      id: r.id,
      kind: "ODOMETER" as const,
      date: r.date,
      vehicleId: r.vehicleId,
      amount: null,
      description: `Odometer reading — ${r.odometerKm.toLocaleString()} km`,
      enteredByName: r.enteredByName,
    })),
  ];

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items.slice(0, take);
}

/** Total row count across all five record tables for a vehicle (excludes soft-deleted rows). One round trip. */
export async function getRecordsCount(vehicleId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT
      (SELECT count(*) FROM fuel_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
    + (SELECT count(*) FROM service_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
    + (SELECT count(*) FROM repair_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
    + (SELECT count(*) FROM expense_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
    + (SELECT count(*) FROM odometer_readings WHERE "vehicleId" = ${vehicleId}) AS total`;
  return Number(row?.total ?? 0);
}

export type RecordType = "fuel" | "service" | "repair" | "expense" | "odometer";

export function recordEntityType(type: RecordType): string {
  switch (type) {
    case "fuel":
      return "FuelRecord";
    case "service":
      return "ServiceRecord";
    case "repair":
      return "RepairRecord";
    case "expense":
      return "ExpenseRecord";
    case "odometer":
      return "OdometerReading";
  }
}

type FoundRecord = {
  type: RecordType;
  vehicleId: string;
  /** Fuel/service/repair/expense soft-delete via deletedAt; odometer readings have no deletedAt column (see schema notes) and are hard-deleted. */
  softDeletable: boolean;
};

/**
 * Records are stored one-table-per-type with no shared id space guarantee
 * beyond cuid uniqueness, so /api/v1/records/:id (which doesn't know the
 * type up front) looks the id up across all five tables.
 */
export async function findRecordById(id: string): Promise<FoundRecord | null> {
  const [fuel, service, repair, expense, odometer] = await Promise.all([
    prisma.fuelRecord.findUnique({ where: { id }, select: { vehicleId: true } }),
    prisma.serviceRecord.findUnique({ where: { id }, select: { vehicleId: true } }),
    prisma.repairRecord.findUnique({ where: { id }, select: { vehicleId: true } }),
    prisma.expenseRecord.findUnique({ where: { id }, select: { vehicleId: true } }),
    prisma.odometerReading.findUnique({ where: { id }, select: { vehicleId: true } }),
  ]);
  if (fuel) return { type: "fuel", vehicleId: fuel.vehicleId, softDeletable: true };
  if (service) return { type: "service", vehicleId: service.vehicleId, softDeletable: true };
  if (repair) return { type: "repair", vehicleId: repair.vehicleId, softDeletable: true };
  if (expense) return { type: "expense", vehicleId: expense.vehicleId, softDeletable: true };
  if (odometer) return { type: "odometer", vehicleId: odometer.vehicleId, softDeletable: false };
  return null;
}

export type TimelineRow = {
  id: string;
  kind: RecordFeedItem["kind"] | "DOCUMENT";
  date: Date;
  vehicleId: string;
  amount: Prisma.Decimal | null;
  description: string;
  enteredByName: string | null;
};

/**
 * One vehicle's merged timeline (all five record tables plus documents),
 * newest first, paginated in the database with a single UNION ALL query and
 * one count query, instead of one query per table. Each branch reads the
 * (vehicleId, date DESC) index.
 */
export async function getVehicleTimeline(vehicleId: string, skip: number, take: number): Promise<{ items: TimelineRow[]; total: number }> {
  type Raw = { id: string; kind: TimelineRow["kind"]; date: Date; vehicleId: string; amount: Prisma.Decimal | null; extra: string | null; label: string | null; enteredByName: string | null };
  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<Raw[]>`
      SELECT * FROM (
        SELECT id, 'FUEL' AS kind, date, "vehicleId", amount, trim_scale(litres)::text AS extra, NULL::text AS label, "enteredByName" FROM fuel_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT id, 'SERVICE', date, "vehicleId", amount, description, NULL, "enteredByName" FROM service_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT id, 'REPAIR', date, "vehicleId", amount, description, NULL, "enteredByName" FROM repair_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT id, 'EXPENSE', date, "vehicleId", amount, category::text, NULL, "enteredByName" FROM expense_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT id, 'ODOMETER', date, "vehicleId", NULL, "odometerKm"::text, NULL, "enteredByName" FROM odometer_readings WHERE "vehicleId" = ${vehicleId}
        UNION ALL
        SELECT d.id, 'DOCUMENT', d."addedAt", d."vehicleId", NULL, d.title, t.label, d."uploadedByAccountId" FROM documents d JOIN document_types t ON t.id = d."documentTypeId" WHERE d."vehicleId" = ${vehicleId} AND d."deletedAt" IS NULL
      ) feed
      ORDER BY date DESC
      LIMIT ${take} OFFSET ${skip}`,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT
        (SELECT count(*) FROM fuel_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
      + (SELECT count(*) FROM service_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
      + (SELECT count(*) FROM repair_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
      + (SELECT count(*) FROM expense_records WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL)
      + (SELECT count(*) FROM odometer_readings WHERE "vehicleId" = ${vehicleId})
      + (SELECT count(*) FROM documents WHERE "vehicleId" = ${vehicleId} AND "deletedAt" IS NULL) AS total`,
  ]);

  const describe = (r: Raw): string => {
    switch (r.kind) {
      case "FUEL":
        return r.extra ? `Fuel — ${r.extra}L` : "Fuel";
      case "SERVICE":
        return r.extra ?? "Service";
      case "REPAIR":
        return r.extra ?? "Repair";
      case "EXPENSE":
        return `Expense — ${r.extra}`;
      case "ODOMETER":
        return `Odometer reading — ${Number(r.extra).toLocaleString()} km`;
      case "DOCUMENT":
        return `${r.label} — ${r.extra}`;
    }
  };

  return {
    items: rows.map((r) => ({ id: r.id, kind: r.kind, date: r.date, vehicleId: r.vehicleId, amount: r.amount, description: describe(r), enteredByName: r.enteredByName })),
    total: Number(counts[0]?.total ?? 0),
  };
}
