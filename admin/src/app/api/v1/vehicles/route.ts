import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createVehicleSchema } from "@/lib/api/schemas";
import { assertCanCreateVehicle } from "@/lib/limits";
import { writeAuditLog } from "@/lib/audit";
import { withApiLogging } from "@/lib/api/withLogging";
import type { Powertrain, VehicleType, VehicleUsage } from "@/generated/prisma/enums";

// GET /api/v1/vehicles?garageId=... — vehicles in a garage the caller
// belongs to, paginated. NOTE: added alongside the mobile integration pass
// (see AGENTS.md/mobile integration report) — the original route only had
// POST, leaving no way to list a garage's vehicles at all, which every
// vehicle-picking screen (Garage home, record entry, reminders, ...) needs.
// Chain: auth -> account -> validate -> membership -> query.
// Wrapped with structured request logging (AGENTS.md scalability pass,
// section 14) — this is one of the endpoints exercised by the load test.
export const GET = withApiLogging("vehicles.list", async (req: NextRequest) => {
  try {
    const account = await requireAccount(req);

    const garageId = req.nextUrl.searchParams.get("garageId");
    if (!garageId) {
      return apiError(422, "VALIDATION_ERROR", "garageId query parameter is required.");
    }

    await requireGarageMembership(account.id, garageId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const where = { garageId };
    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.vehicle.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/v1/vehicles — add a vehicle to a garage the caller belongs to.
// Chain: auth -> account -> garage membership -> plan limit -> validate -> create -> audit log.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid vehicle payload.", parsed.error.flatten());
    }

    const input = parsed.data;
    await requireGarageMembership(account.id, input.garageId);
    await assertCanCreateVehicle(input.garageId);

    const vehicle = await prisma.vehicle.create({
      data: {
        garageId: input.garageId,
        make: input.make,
        model: input.model,
        year: input.year,
        type: input.type as VehicleType | undefined,
        usage: input.usage as VehicleUsage | undefined,
        plate: input.plate,
        odometerKm: input.odometerKm,
        photo: input.photo,
        vin: input.vin,
        powertrain: input.powertrain as Powertrain | undefined,
        nextServiceDueKm: input.nextServiceDueKm,
        color: input.color,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "vehicle.create",
      entityType: "Vehicle",
      entityId: vehicle.id,
    });

    return apiOk(vehicle, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
