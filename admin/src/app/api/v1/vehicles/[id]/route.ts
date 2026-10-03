import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess, requireVehicleOwnerAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateVehicleSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { Powertrain, Transmission, VehicleType, VehicleUsage } from "@/generated/prisma/enums";

// GET /api/v1/vehicles/:id
// Chain: auth -> account -> membership/ownership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireVehicleAccess(account.id, id);

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundError("Vehicle not found.");
    }

    return apiOk(vehicle);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/vehicles/:id
// Chain: auth -> account -> garage ownership -> validate -> update -> audit log.
// Any garage member can add records, but editing the vehicle's own fields
// (plate, odometer baseline, etc.) is restricted to the garage owner.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireVehicleOwnerAccess(account.id, id);

    const body = await req.json().catch(() => null);
    const parsed = updateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid vehicle payload.", parsed.error.flatten());
    }

    const data = parsed.data;
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        type: data.type as VehicleType | undefined,
        usage: data.usage as VehicleUsage | undefined,
        powertrain: data.powertrain as Powertrain | undefined,
        transmission: data.transmission as Transmission | undefined,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "vehicle.update",
      entityType: "Vehicle",
      entityId: vehicle.id,
      metadata: data,
    });

    return apiOk(vehicle);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/vehicles/:id
// Vehicle itself has no deletedAt column (unlike its records/documents),
// so removing one is a hard delete of the vehicle row — its history rows
// (fuel/service/repair/expense/documents/invoices) remain soft-deletable
// individually and cascade-delete with the vehicle per schema.prisma
// onDelete: Cascade. Restricted to the garage owner.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireVehicleOwnerAccess(account.id, id);

    await prisma.vehicle.delete({ where: { id } });

    await writeAuditLog({
      actorId: account.id,
      action: "vehicle.delete",
      entityType: "Vehicle",
      entityId: id,
    });

    return apiOk({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
