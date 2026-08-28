import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createRecordSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getRecordsFeed, getRecordsCount, recordEntityType, type RecordType } from "@/lib/records";
import { ExpenseCategory } from "@/generated/prisma/enums";
import type {
  FuelRecord,
  ServiceRecord,
  RepairRecord,
  ExpenseRecord,
  OdometerReading,
} from "@/generated/prisma/client";

type AnyRecordRow = FuelRecord | ServiceRecord | RepairRecord | ExpenseRecord | OdometerReading;

const RECORD_TYPES: RecordType[] = ["fuel", "service", "repair", "expense", "odometer"];

// GET /api/v1/vehicles/:id/records — paginated, optionally filtered by
// ?type=fuel|service|repair|expense|odometer. Without a type filter, this
// returns the same merged reverse-chronological feed used by the dashboard
// (src/lib/records.ts), paginated.
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const typeParam = req.nextUrl.searchParams.get("type");

    if (typeParam) {
      if (!RECORD_TYPES.includes(typeParam as RecordType)) {
        return apiError(422, "VALIDATION_ERROR", `type must be one of: ${RECORD_TYPES.join(", ")}.`);
      }
      const type = typeParam as RecordType;
      const { items, total } = await getRecordsOfType(vehicleId, type, skip, take);
      return apiOkPaginated(items, { page, pageSize, total });
    }

    // Merged feed: over-fetch enough of each type to cover this page, sort,
    // then slice — heterogeneous sources can't be paginated at the DB level.
    const [items, total] = await Promise.all([
      getRecordsFeed({ vehicleId, take: skip + take }),
      getRecordsCount(vehicleId),
    ]);
    return apiOkPaginated(items.slice(skip, skip + take), { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getRecordsOfType(
  vehicleId: string,
  type: RecordType,
  skip: number,
  take: number,
): Promise<{ items: AnyRecordRow[]; total: number }> {
  switch (type) {
    case "fuel": {
      const where = { vehicleId, deletedAt: null };
      const [items, total] = await Promise.all([
        prisma.fuelRecord.findMany({ where, orderBy: { date: "desc" }, skip, take }),
        prisma.fuelRecord.count({ where }),
      ]);
      return { items, total };
    }
    case "service": {
      const where = { vehicleId, deletedAt: null };
      const [items, total] = await Promise.all([
        prisma.serviceRecord.findMany({ where, orderBy: { date: "desc" }, skip, take }),
        prisma.serviceRecord.count({ where }),
      ]);
      return { items, total };
    }
    case "repair": {
      const where = { vehicleId, deletedAt: null };
      const [items, total] = await Promise.all([
        prisma.repairRecord.findMany({ where, orderBy: { date: "desc" }, skip, take }),
        prisma.repairRecord.count({ where }),
      ]);
      return { items, total };
    }
    case "expense": {
      const where = { vehicleId, deletedAt: null };
      const [items, total] = await Promise.all([
        prisma.expenseRecord.findMany({ where, orderBy: { date: "desc" }, skip, take }),
        prisma.expenseRecord.count({ where }),
      ]);
      return { items, total };
    }
    case "odometer": {
      const where = { vehicleId };
      const [items, total] = await Promise.all([
        prisma.odometerReading.findMany({ where, orderBy: { date: "desc" }, skip, take }),
        prisma.odometerReading.count({ where }),
      ]);
      return { items, total };
    }
  }
}

// POST /api/v1/vehicles/:id/records
// Chain: auth -> account -> membership/ownership -> validate -> create -> audit log.
// Any garage member (or account with direct vehicle access) may add a
// record; there is no plan-limit check here — plans cap garages/vehicles/
// seats/jobs, not history entries.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = createRecordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid record payload.", parsed.error.flatten());
    }

    const input = parsed.data;
    const record = await createRecord(vehicleId, input);

    await writeAuditLog({
      actorId: account.id,
      action: `record.create.${input.type}`,
      entityType: recordEntityType(input.type),
      entityId: record.id,
    });

    return apiOk(record, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

type CreateRecordInput = ReturnType<typeof createRecordSchema.parse>;

async function createRecord(vehicleId: string, input: CreateRecordInput) {
  switch (input.type) {
    case "fuel":
      return prisma.fuelRecord.create({
        data: {
          vehicleId,
          date: new Date(input.date),
          amount: input.amount,
          litres: input.litres,
          odometerAtEntry: input.odometerAtEntry,
          place: input.place,
          enteredByName: input.enteredByName,
          notes: input.notes,
        },
      });
    case "service":
      return prisma.serviceRecord.create({
        data: {
          vehicleId,
          date: new Date(input.date),
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          description: input.description,
          place: input.place,
          enteredByName: input.enteredByName,
          notes: input.notes,
        },
      });
    case "repair":
      return prisma.repairRecord.create({
        data: {
          vehicleId,
          date: new Date(input.date),
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          description: input.description,
          place: input.place,
          enteredByName: input.enteredByName,
          notes: input.notes,
        },
      });
    case "expense":
      return prisma.expenseRecord.create({
        data: {
          vehicleId,
          date: new Date(input.date),
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          category: input.category as ExpenseCategory,
          place: input.place,
          enteredByName: input.enteredByName,
          notes: input.notes,
        },
      });
    case "odometer":
      return prisma.odometerReading.create({
        data: {
          vehicleId,
          date: new Date(input.date),
          odometerKm: input.odometerKm,
          enteredByName: input.enteredByName,
          notes: input.notes,
        },
      });
  }
}
