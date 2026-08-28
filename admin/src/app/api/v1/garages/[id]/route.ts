import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireGarageOwner } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateGarageSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// GET /api/v1/garages/:id
// Chain: auth -> account -> membership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireGarageMembership(account.id, id);

    const garage = await prisma.garage.findUnique({ where: { id } });
    if (!garage) {
      throw new NotFoundError("Garage not found.");
    }

    return apiOk(garage);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/garages/:id
// Chain: auth -> account -> owner-level membership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireGarageOwner(account.id, id);

    const body = await req.json().catch(() => null);
    const parsed = updateGarageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid garage payload.", parsed.error.flatten());
    }

    const garage = await prisma.garage.update({ where: { id }, data: parsed.data });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.update",
      entityType: "Garage",
      entityId: garage.id,
      metadata: parsed.data,
    });

    return apiOk(garage);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/garages/:id
// Garage has no deletedAt column (not a financial/history row); deleting one
// cascades to its vehicles and everything under them per schema.prisma
// onDelete: Cascade. Owner-only, deliberately destructive and rare — the
// mobile app should confirm heavily before calling this.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireGarageOwner(account.id, id);

    await prisma.garage.delete({ where: { id } });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.delete",
      entityType: "Garage",
      entityId: id,
    });

    return apiOk({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
