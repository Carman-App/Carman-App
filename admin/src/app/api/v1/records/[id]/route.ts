import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateRecordSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { findRecordById, recordEntityType } from "@/lib/records";
import type { ExpenseCategory } from "@/generated/prisma/enums";

// PATCH /api/v1/records/:id — the id alone doesn't say which of the five
// record tables it belongs to (see src/lib/records.ts findRecordById), so
// this looks it up first, then applies only the fields relevant to that type.
// Chain: auth -> account -> resolve record -> membership/ownership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const found = await findRecordById(id);
    if (!found) {
      throw new NotFoundError("Record not found.");
    }
    await requireVehicleAccess(account.id, found.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = updateRecordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid record payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    const record = await updateRecord(id, found.type, input);

    await writeAuditLog({
      actorId: account.id,
      action: `record.update.${found.type}`,
      entityType: recordEntityType(found.type),
      entityId: id,
      metadata: input,
    });

    return apiOk(record);
  } catch (error) {
    return handleApiError(error);
  }
}

async function updateRecord(
  id: string,
  type: "fuel" | "service" | "repair" | "expense" | "odometer",
  input: ReturnType<typeof updateRecordSchema.parse>,
) {
  const date = input.date ? new Date(input.date) : undefined;
  // DATA-02 — every real PATCH stamps editedAt, the one genuine "this record
  // was edited after creation" signal (see schema.prisma FuelRecord.editedAt
  // comment). Distinct from createdAt/date so entered-late vs. edited-later
  // can be told apart.
  const editedAt = new Date();
  switch (type) {
    case "fuel":
      return prisma.fuelRecord.update({
        where: { id },
        data: {
          date,
          amount: input.amount,
          litres: input.litres,
          odometerAtEntry: input.odometerAtEntry,
          place: input.place,
          notes: input.notes,
          editedAt,
        },
      });
    case "service":
      return prisma.serviceRecord.update({
        where: { id },
        data: {
          date,
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          description: input.description,
          place: input.place,
          notes: input.notes,
          editedAt,
        },
      });
    case "repair":
      return prisma.repairRecord.update({
        where: { id },
        data: {
          date,
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          description: input.description,
          place: input.place,
          notes: input.notes,
          editedAt,
        },
      });
    case "expense":
      return prisma.expenseRecord.update({
        where: { id },
        data: {
          date,
          amount: input.amount,
          odometerAtEntry: input.odometerAtEntry,
          category: input.category as ExpenseCategory | undefined,
          place: input.place,
          notes: input.notes,
          editedAt,
        },
      });
    case "odometer":
      return prisma.odometerReading.update({
        where: { id },
        data: {
          date,
          odometerKm: input.odometerKm,
          notes: input.notes,
          editedAt,
        },
      });
  }
}

// DELETE /api/v1/records/:id — soft-delete for fuel/service/repair/expense
// (deletedAt, per schema.prisma's financial/history pattern). OdometerReading
// has no deletedAt column in the schema — it isn't listed among the
// soft-deletable models in the schema's own header comment — so it is hard
// deleted; a mis-entered odometer reading isn't financial history worth
// retaining a tombstone for.
// Chain: auth -> account -> resolve record -> membership/ownership -> delete -> audit log.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const found = await findRecordById(id);
    if (!found) {
      throw new NotFoundError("Record not found.");
    }
    await requireVehicleAccess(account.id, found.vehicleId);

    if (found.softDeletable) {
      const deletedAt = new Date();
      switch (found.type) {
        case "fuel":
          await prisma.fuelRecord.update({ where: { id }, data: { deletedAt } });
          break;
        case "service":
          await prisma.serviceRecord.update({ where: { id }, data: { deletedAt } });
          break;
        case "repair":
          await prisma.repairRecord.update({ where: { id }, data: { deletedAt } });
          break;
        case "expense":
          await prisma.expenseRecord.update({ where: { id }, data: { deletedAt } });
          break;
      }
    } else {
      await prisma.odometerReading.delete({ where: { id } });
    }

    await writeAuditLog({
      actorId: account.id,
      action: found.softDeletable ? `record.soft_delete.${found.type}` : `record.delete.${found.type}`,
      entityType: recordEntityType(found.type),
      entityId: id,
    });

    return apiOk({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
