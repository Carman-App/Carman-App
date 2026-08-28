import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess, requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createAccessRequestSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// GET /api/v1/vehicles/:id/access-requests — the owner's view of incoming
// requests from workshops, paginated.
// Chain: auth -> account -> vehicle ownership/membership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const where = { vehicleId };
    const [items, total] = await Promise.all([
      prisma.accessRequest.findMany({
        where,
        include: { workshop: { select: { id: true, name: true } }, grant: true },
        orderBy: { requestedAt: "desc" },
        skip,
        take,
      }),
      prisma.accessRequest.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/vehicles/:id/access-requests — a workshop asking to see a
// vehicle's history. The caller does NOT need vehicle access (that's the
// whole point of asking); they need to be a member of the workshop making
// the request, given in the body.
// Chain: auth -> account -> workshop membership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = createAccessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid access request payload.", parsed.error.flatten());
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!vehicle) {
      return apiError(404, "NOT_FOUND", "Vehicle not found.");
    }

    const workshop = await requireWorkshopMembership(account.id, parsed.data.workshopId);
    const member = workshop.ownerId === account.id
      ? null
      : await prisma.workshopMember.findUnique({
          where: { workshopId_accountId: { workshopId: parsed.data.workshopId, accountId: account.id } },
        });

    const accessRequest = await prisma.accessRequest.create({
      data: {
        vehicleId,
        workshopId: parsed.data.workshopId,
        requestedByWorkshopMemberId: member?.id,
        scope: parsed.data.scope,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "access_request.create",
      entityType: "AccessRequest",
      entityId: accessRequest.id,
      metadata: { vehicleId, workshopId: parsed.data.workshopId },
    });

    return apiOk(accessRequest, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
